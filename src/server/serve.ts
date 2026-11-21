import { createServer as createHttpServer } from 'node:http'

import express from 'express'

import type { VueForgeConfig } from '../index.js'
import { developmentRenderer } from './development.js'
import { productionRenderer } from './production.js'
import { renderRoute } from './render-route.js'

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

  const renderer = dev
    ? await developmentRenderer(root, config, server, host, port)
    : await productionRenderer(tempDir)

  app.get('/healthz', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok' })
  })

  app.get('/', (_req, res) => {
    res.type('text/plain').send('Welcome to VueForge!')
  })

  app.use('/render', renderRoute(renderer.render))
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
