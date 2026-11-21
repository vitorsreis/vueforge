import { createRequire } from 'node:module'

import express from 'express'

import { resolveBuildOutputDir, resolveRenderLimits } from '../config.js'
import { resolveServerTransport } from './transports/config.js'
import type { VueForgeConfig } from '../index.js'
import type { Render } from '../render/renderer.js'
import { createRenderHandler } from './render/handler.js'
import { developmentRenderer } from './development.js'
import { productionRenderer } from './production/renderer.js'
import { productionWorkerRenderer } from './production/worker-renderer.js'
import { renderRoute } from './render/route.js'
import { createNodeServer, startNodeAdapter } from './adapter/node.js'
import { serveStdio } from './transports/stdio.js'
import type { ServerTransport } from './transports/http.js'

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
