import { createServer as createHttpServer } from 'node:http'

import express from 'express'
import type { UserConfig } from 'vite'

import { developmentRenderer } from './development.js'
import { productionRenderer } from './production.js'
import { renderRoute } from './render-route.js'

export async function serveProject(
  root: string,
  dev: boolean,
  { host, port }: { host: string; port: number },
  tempDir: string,
  config: UserConfig = {},
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

  app.use('/render', renderRoute(renderer.render))
  app.use(renderer.middleware)

  app.get('/', async (req, res) => {
    const html = await renderer.render()
    const shell = await renderer.template(req.originalUrl)
    res.type('html').send(shell.replace('<!--vueforge-->', () => html))
  })

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
