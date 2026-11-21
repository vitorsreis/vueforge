import { createServer as createHttpServer } from 'node:http'

import express from 'express'

import type { VueForgeConfig } from '../index.js'
import { renderResponse } from '../render/result.js'
import { developmentRenderer } from './development.js'
import { productionRenderer } from './production.js'
import { renderRoute } from './render-route.js'
import { documentShell } from './renderer.js'

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

  app.use('/render', renderRoute(renderer.render))
  app.use(renderer.middleware)

  app.get('/', async (req, res) => {
    const result = await renderer.render()
    if ('transformDocument' in renderer) {
      // Vite inserts its own client when transforming a full HTML document.
      result.assets = result.assets.filter(
        ({ tag, attrs }) => tag !== 'script' || attrs.src !== '/@vite/client',
      )
    }
    const { head, content } = renderResponse(result, {
      format: 'html',
      hydrate: true,
    })
    const html = documentShell(head, content)
    res
      .type('html')
      .send(
        'transformDocument' in renderer
          ? await renderer.transformDocument(req.originalUrl, html)
          : html,
      )
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
