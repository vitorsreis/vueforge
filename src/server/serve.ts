import { createRequire } from 'node:module'

import express from 'express'

import { resolveBuildOutputDir, resolveRenderLimits } from '../config.js'
import { resolveServerTransport } from './transport-config.js'
import type { VueForgeConfig } from '../index.js'
import type { Render } from '../render/renderer.js'
import { createRenderHandler } from './render-handler.js'
import { developmentRenderer } from './development.js'
import { productionRenderer } from './production.js'
import { productionWorkerRenderer } from './production-worker-renderer.js'
import { renderRoute } from './render-route.js'
import { createNodeServer, startNodeAdapter } from './adapter/node.js'
import {
  hasBunRuntime,
  startBunAdapter,
  startBunProxyAdapter,
} from './adapter/bun.js'
import { readJsonRequestBody } from './http-render-input.js'
import { serveStdio } from './stdio.js'
import type { ServerTransport } from './transports.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

export interface ServeProjectOptions {
  host: string
  port: number
  unix?: string
  stdio?: boolean
}

interface RenderService {
  render: Render
  middleware: express.RequestHandler | undefined
  close: (() => Promise<void> | void) | undefined
  hostGuard: express.RequestHandler | undefined
  allowedHosts: true | readonly string[]
}

function transportFromOptions(
  root: string,
  config: VueForgeConfig,
  options: ServeProjectOptions,
): ServerTransport {
  return resolveServerTransport(root, config, options)
}

function handlerOptions(
  config: VueForgeConfig,
  limits: ReturnType<typeof resolveRenderLimits>,
  extra: { development?: boolean; interruptible?: boolean; root?: string } = {},
) {
  return {
    ...limits,
    defaultFormat: config.format ?? ('json' as const),
    ...(config.document === undefined ? {} : { document: config.document }),
    ...extra,
  }
}

async function* requestChunks(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<Uint8Array> {
  if (!body) return
  const reader = body.getReader()
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) return
      yield chunk.value
    }
  } finally {
    reader.releaseLock()
  }
}

function bunFetchHandler(render: Render, config: VueForgeConfig, root: string) {
  const limits = resolveRenderLimits(config)
  const handleRender = createRenderHandler(
    render,
    handlerOptions(config, limits, { root }),
  )

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(
        JSON.stringify({
          message: 'Welcome to VueForge!',
          poweredBy: 'Vitor Reis',
          repo: 'https://github.com/vitorsreis/vueforge',
          version,
        }),
        { headers: { 'content-type': 'application/json; charset=utf-8' } },
      )
    }
    if (request.method === 'GET' && url.pathname === '/healthz') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: {
          'cache-control': 'no-store',
          'content-type': 'application/json; charset=utf-8',
        },
      })
    }
    if (request.method !== 'POST' || url.pathname !== '/render')
      return new Response('Not Found', { status: 404 })

    try {
      const contentType = request.headers.get('content-type')
      const contentEncoding = request.headers.get('content-encoding')
      const body = await readJsonRequestBody(requestChunks(request.body), {
        ...(contentType === null ? {} : { contentType }),
        ...(contentEncoding === null ? {} : { contentEncoding }),
        maxBytes: limits.maxRequestBytes,
      })
      const error = url.searchParams.get('error')
      const response = await handleRender({
        body,
        accept: request.headers.get('accept') ?? undefined,
        ...(error === 'html' || error === 'json' ? { errorFormat: error } : {}),
      })
      return new Response(
        typeof response.body === 'string'
          ? response.body
          : JSON.stringify(response.body),
        {
          status: response.status,
          ...(response.headers === undefined
            ? {}
            : { headers: response.headers }),
        },
      )
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number(error.status)
          : 400
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        },
      )
    }
  }
}

export async function serveProject(
  root: string,
  dev: boolean,
  options: ServeProjectOptions,
  _tempDir: string,
  config: VueForgeConfig = {},
) {
  if (
    config.shutdownTimeoutMs !== undefined &&
    (!Number.isSafeInteger(config.shutdownTimeoutMs) ||
      config.shutdownTimeoutMs < 1)
  ) {
    throw new Error(
      'vueforge.config.ts: shutdownTimeoutMs must be a positive safe integer.',
    )
  }
  const transport = transportFromOptions(root, config, options)
  const limits = resolveRenderLimits(config)

  if (transport.kind === 'stdio') {
    if (dev) throw new Error('The stdio transport cannot be used with --dev.')
    const renderer = await productionRenderer(
      resolveBuildOutputDir(root, config.build?.outDir),
      (entry) => productionWorkerRenderer(entry, limits),
    )
    const handleRender = createRenderHandler(
      renderer.render,
      handlerOptions(config, limits),
    )
    try {
      await serveStdio({
        maxRequestBytes: limits.maxRequestBytes,
        handle: async (body) => (await handleRender({ body })).body,
      })
    } finally {
      await renderer.close?.()
    }
    return
  }

  if (hasBunRuntime() && dev) {
    if (transport.kind === 'unix') {
      throw new Error('Bun development mode requires a TCP listener for HMR.')
    }

    const app = express()
    app.disable('x-powered-by')
    const internalServer = await createNodeServer(root, undefined, app)
    const internalAdapter = await startNodeAdapter({
      server: internalServer,
      requestHandler: app,
      root,
      transport: { kind: 'tcp', host: '127.0.0.1', port: 0 },
    })
    const address = internalServer.address()
    if (address === null || typeof address === 'string') {
      await internalAdapter.close()
      throw new Error('VueForge could not determine the internal Vite port.')
    }

    let renderer: RenderService | undefined
    let adapter: Awaited<ReturnType<typeof startBunProxyAdapter>> | undefined
    try {
      renderer = {
        ...(await developmentRenderer(
          root,
          config,
          internalServer,
          '127.0.0.1',
          address.port,
          transport.port,
        )),
      }
      if (renderer.hostGuard !== undefined) app.use(renderer.hostGuard)
      app.get('/healthz', (_request, response) => {
        response.set('Cache-Control', 'no-store').json({ status: 'ok' })
      })
      app.get('/', (_request, response) =>
        response.json({
          message: 'Welcome to VueForge!',
          poweredBy: 'Vitor Reis',
          repo: 'https://github.com/vitorsreis/vueforge',
          version,
        }),
      )
      app.use(
        '/render',
        renderRoute(
          renderer.render,
          handlerOptions(config, limits, {
            development: true,
            interruptible: true,
            root,
          }),
        ),
      )
      app.use(
        renderer.middleware ??
          ((_request, response) => response.status(404).end()),
      )

      adapter = await startBunProxyAdapter({
        root,
        targetOrigin: `http://127.0.0.1:${String(address.port)}`,
        transport,
        ...(config.ssl === undefined ? {} : { ssl: config.ssl }),
        ...(config.shutdownTimeoutMs === undefined
          ? {}
          : { shutdownTimeoutMs: config.shutdownTimeoutMs }),
        allowedHosts: renderer.allowedHosts,
      })
      const close = async () => {
        process.off('SIGINT', signalHandler)
        process.off('SIGTERM', signalHandler)
        await renderer?.close?.()
        await adapter?.close()
        await internalAdapter.close()
      }
      const signalHandler = () => {
        void close().finally(() => {
          process.exitCode = 0
        })
      }
      process.once('SIGINT', signalHandler)
      process.once('SIGTERM', signalHandler)
      console.log(
        `VueForge listening on ${config.ssl ? 'https' : 'http'}://${transport.host}:${String(transport.port)}`,
      )
      return { close }
    } catch (error) {
      await renderer?.close?.()
      await adapter?.close()
      await internalAdapter.close()
      throw error
    }
  }

  if (hasBunRuntime() && !dev) {
    const renderer = await productionRenderer(
      resolveBuildOutputDir(root, config.build?.outDir),
      (entry) => productionWorkerRenderer(entry, limits),
    )
    try {
      const adapter = await startBunAdapter({
        fetch: bunFetchHandler(renderer.render, config, root),
        root,
        ...(config.ssl === undefined ? {} : { ssl: config.ssl }),
        ...(config.shutdownTimeoutMs === undefined
          ? {}
          : { shutdownTimeoutMs: config.shutdownTimeoutMs }),
        transport,
      })
      const protocol = config.ssl ? 'https' : 'http'
      const address =
        transport.kind === 'unix'
          ? transport.path
          : `${transport.host.includes(':') ? `[${transport.host}]` : transport.host}:${String(transport.port)}`
      console.log(`VueForge listening on ${protocol}://${address}`)
      const close = async () => {
        process.off('SIGINT', signalHandler)
        process.off('SIGTERM', signalHandler)
        await renderer.close?.()
        await adapter.close()
      }
      const signalHandler = () => {
        void close().finally(() => {
          process.exitCode = 0
        })
      }
      process.once('SIGINT', signalHandler)
      process.once('SIGTERM', signalHandler)
      return { close }
    } catch (error) {
      await renderer.close?.()
      throw error
    }
  }

  const app = express()
  app.disable('x-powered-by')
  const nodeServer = await createNodeServer(root, config.ssl, app)

  let renderer: RenderService
  if (dev) {
    if (transport.kind === 'unix')
      throw new Error('Development mode requires a TCP listener for Vite HMR.')
    renderer = await developmentRenderer(
      root,
      config,
      nodeServer,
      transport.host,
      transport.port,
    )
  } else {
    renderer = {
      ...(await productionRenderer(
        resolveBuildOutputDir(root, config.build?.outDir),
        (entry) => productionWorkerRenderer(entry, limits),
      )),
      hostGuard: undefined,
      allowedHosts: true,
    }
  }

  if (renderer.hostGuard !== undefined) app.use(renderer.hostGuard)

  app.get('/healthz', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({ status: 'ok' })
  })
  app.get('/', (_request, response) =>
    response.json({
      message: 'Welcome to VueForge!',
      poweredBy: 'Vitor Reis',
      repo: 'https://github.com/vitorsreis/vueforge',
      version,
    }),
  )
  app.use(
    '/render',
    renderRoute(
      renderer.render,
      handlerOptions(config, limits, {
        development: dev,
        interruptible: dev,
        ...(dev ? { root } : {}),
      }),
    ),
  )
  app.use(
    renderer.middleware ?? ((_request, response) => response.status(404).end()),
  )

  const adapter = await startNodeAdapter({
    server: nodeServer,
    requestHandler: app,
    root,
    ...(config.shutdownTimeoutMs === undefined
      ? {}
      : { shutdownTimeoutMs: config.shutdownTimeoutMs }),
    transport,
  })

  let shuttingDown: Promise<void> | undefined
  const close = async () => {
    shuttingDown ??= (async () => {
      process.off('SIGINT', signalHandler)
      process.off('SIGTERM', signalHandler)
      await renderer.close?.()
      await adapter.close()
    })()
    await shuttingDown
  }
  const signalHandler = () => {
    void close().finally(() => {
      process.exitCode = 0
    })
  }
  process.once('SIGINT', signalHandler)
  process.once('SIGTERM', signalHandler)

  const protocol = config.ssl ? 'https' : 'http'
  const address =
    transport.kind === 'unix'
      ? transport.path
      : `${transport.host.includes(':') ? `[${transport.host}]` : transport.host}:${String(transport.port)}`
  console.log(`VueForge listening on ${protocol}://${address}`)

  return { close }
}
