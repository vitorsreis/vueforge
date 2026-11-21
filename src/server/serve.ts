import { createServer as createHttpServer } from 'node:http'
import { createRequire } from 'node:module'

import express from 'express'

import type { VueForgeConfig } from '../index.js'
import { developmentRenderer } from './development.js'
import { productionRenderer } from './production.js'
import { productionWorkerRenderer } from './production-worker-renderer.js'
import { renderRoute } from './render-route.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

export async function serveProject(
  root: string,
  dev: boolean,
  { host, port }: { host: string; port: number },
  tempDir: string,
  config: VueForgeConfig = {},
) {
  const app = express()
  app.disable('x-powered-by')
  const server = createHttpServer(app)

  let renderer
  if (dev) {
    const development = await developmentRenderer(
      root,
      config,
      server,
      host,
      port,
    )
    if (development.hostGuard) app.use(development.hostGuard)
    renderer = development
  } else {
    renderer = await productionRenderer(tempDir, productionWorkerRenderer)
  }

  app.get('/healthz', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok' })
  })

  app.get('/', (_req, res) => {
    res.json({
      message: 'Welcome to VueForge!',
      poweredBy: 'Vitor Reis',
      repo: 'https://github.com/vitorsreis/vueforge',
      version,
    })
  })

  app.use('/render', renderRoute(renderer.render, { interruptible: !dev }))
  app.use(renderer.middleware)

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, resolve)
    })
  } catch (error) {
    await renderer.close?.()
    throw error
  }

  const displayHost = host.includes(':') ? `[${host}]` : host
  console.log(`VueForge listening on http://${displayHost}:${String(port)}`)
}
