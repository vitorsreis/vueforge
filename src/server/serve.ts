import { createRequire } from 'node:module'

import express from 'express'

import {
  resolveAssetBase,
  resolveBuildOutputDir,
  resolveAppSources,
  resolveRenderLimits,
} from '../config.js'
import { resolveServerTransport } from './transports/config.js'
import type { VueforgeConfig } from '../index.js'
import type { Render } from '../render/renderer.js'
import { createRenderHandler } from './render/handler.js'
import { developmentRenderer } from './development.js'
import { productionRenderer } from './production/renderer.js'
import { productionWorkerRenderer } from './production/worker-renderer.js'
import { renderRoute } from './render/route.js'
import { createNodeServer, startNodeAdapter } from './adapter/node.js'
import { createCorsMiddleware } from './http/cors.js'
import { serveStdio } from './transports/stdio.js'
import type { ServerTransport } from './transports/http.js'
import { queryBoolean } from '../render/query.js'

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
  config: VueforgeConfig,
  options: ServeProjectOptions,
): ServerTransport {
  return resolveServerTransport(root, config, options)
}

function handlerOptions(
  config: VueforgeConfig,
  limits: ReturnType<typeof resolveRenderLimits>,
  extra: { development?: boolean; interruptible?: boolean; root?: string } = {},
  sources?: Awaited<ReturnType<typeof resolveAppSources>>,
) {
  return {
    ...limits,
    defaultFormat: config.format ?? ('json' as const),
    ...(config.document === undefined ? {} : { document: config.document }),
    ...(sources?.kind !== 'templates'
      ? {}
      : {
          requireTemplate: true,
          templateNames: Object.keys(sources.templates),
        }),
    ...extra,
  }
}

export async function serveProject(
  root: string,
  dev: boolean,
  options: ServeProjectOptions,
  _tempDir: string,
  config: VueforgeConfig = {},
) {
  if (
    config.server?.shutdownTimeoutMs !== undefined &&
    (!Number.isSafeInteger(config.server.shutdownTimeoutMs) ||
      config.server.shutdownTimeoutMs < 1)
  ) {
    throw new Error(
      'vueforge.config.ts: server.shutdownTimeoutMs must be a positive safe integer.',
    )
  }
  const transport = transportFromOptions(root, config, options)
  const limits = resolveRenderLimits(config)
  const sources =
    dev || config.main !== undefined
      ? await resolveAppSources(root, config)
      : undefined

  if (transport.kind === 'stdio') {
    if (dev) throw new Error('The stdio transport cannot be used with --dev.')
    const renderer = await productionRenderer(
      resolveBuildOutputDir(root, config.build?.outDir),
      resolveAssetBase(config.origin, config.base),
      (entry) => productionWorkerRenderer(entry, limits),
    )
    const handleRender = createRenderHandler(
      renderer.render,
      handlerOptions(config, limits, {}, sources),
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
  app.use(createCorsMiddleware(config.server?.cors))
  const nodeServer = await createNodeServer(root, config.server?.ssl, app)

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
        resolveAssetBase(config.origin, config.base),
        (entry) => productionWorkerRenderer(entry, limits),
      )),
      hostGuard: undefined,
    }
  }

  if (renderer.hostGuard !== undefined) app.use(renderer.hostGuard)

  function sendJson(
    request: express.Request,
    response: express.Response,
    value: unknown,
  ) {
    const pretty = queryBoolean(request.originalUrl, 'pretty')
    response
      .type('json')
      .send(JSON.stringify(value, null, pretty ? 2 : undefined))
  }

  app.get('/healthz', (request, response) => {
    response.set('Cache-Control', 'no-store')
    sendJson(request, response, { status: 'ok' })
  })
  app.get('/', (request, response) => {
    sendJson(request, response, {
      message: 'Welcome to Vueforge!',
      poweredBy: 'Vitor Reis',
      repo: 'https://github.com/vitorsreis/vueforge',
      version,
    })
  })
  app.use(
    '/render',
    renderRoute(
      renderer.render,
      handlerOptions(
        config,
        limits,
        {
          development: dev,
          interruptible: dev,
          ...(dev ? { root } : {}),
        },
        sources,
      ),
    ),
  )
  app.use(
    renderer.middleware ?? ((_request, response) => response.status(404).end()),
  )

  const adapter = await startNodeAdapter({
    server: nodeServer,
    requestHandler: app,
    root,
    ...(config.server?.shutdownTimeoutMs === undefined
      ? {}
      : { shutdownTimeoutMs: config.server.shutdownTimeoutMs }),
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

  const protocol = config.server?.ssl ? 'https' : 'http'
  const address =
    transport.kind === 'unix'
      ? transport.path
      : `${transport.host.includes(':') ? `[${transport.host}]` : transport.host}:${String(transport.port)}`
  console.log(`Vueforge listening on ${protocol}://${address}`)

  return { close }
}
