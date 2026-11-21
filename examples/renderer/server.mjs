/* global Buffer, URL, console, process */

import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

import { createVueforgeRenderer } from '../../dist/index.js'

const root = fileURLToPath(new URL('./', import.meta.url))
const mode =
  process.env.VUEFORGE_MODE === 'production' ? 'production' : 'development'
const renderer = await createVueforgeRenderer({
  root,
  mode,
  config: {
    main: 'src/App.vue',
    vite: { server: { hmr: false } },
  },
})

function readContext(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('Send a valid JSON context object.'))
      }
    })
    request.on('error', reject)
  })
}

const server = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url === undefined) {
    response.writeHead(404).end()
    return
  }

  const url = new URL(request.url, 'http://localhost')
  if (url.pathname !== '/render') {
    response.writeHead(404).end()
    return
  }

  try {
    const body = await readContext(request)
    const rendered = await renderer.render({
      context: body,
      ...(url.searchParams.get('format') === null
        ? {}
        : { format: url.searchParams.get('format') }),
      ...(url.searchParams.has('hydrate') ? { hydrate: true } : {}),
    })
    const output =
      typeof rendered.body === 'string'
        ? rendered.body
        : JSON.stringify(
            rendered.body,
            url.searchParams.has('pretty') ? 2 : undefined,
          )
    response.writeHead(rendered.status, rendered.headers).end(output)
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        error: error instanceof Error ? error.message : error,
      }),
    )
  }
})

const close = async () => {
  await renderer.close()
  server.close()
}

process.once('SIGINT', close)
process.once('SIGTERM', close)
server.listen(9902, '127.0.0.1', () => {
  console.log(
    `Custom renderer server listening on http://127.0.0.1:9902 (${mode})`,
  )
})
