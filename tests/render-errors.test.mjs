import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import test from 'node:test'

import express from 'express'

import { renderRoute } from '../dist/server/render/route.js'

const { fetch } = globalThis

test('development render errors support HTML and JSON diagnostics', async (t) => {
  const root = await mkdtemp(join('.vueforge', 'render-errors-'))
  const source = resolve(root, 'src/App.vue')
  await mkdir(join(root, 'src'))
  await writeFile(
    source,
    '<template>\n  <main>{{ broken }}</main>\n</template>\n',
  )

  const error = Object.assign(new Error('Unexpected token'), {
    name: 'SyntaxError',
    id: source,
    loc: { line: 2, column: 10 },
    frame:
      '  1 | <template>\n> 2 |   <main>{{ broken }}</main>\n    |          ^',
    plugin: 'vite:vue',
  })
  const server = express()
    .use(
      '/render',
      renderRoute(
        async () => {
          throw error
        },
        { development: true, interruptible: true, root },
      ),
    )
    .listen(0, '127.0.0.1')
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  })
  await once(server, 'listening')

  const origin = `http://127.0.0.1:${server.address().port}/render`
  const html = await fetch(origin + '?error=html', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  assert.equal(html.status, 500)
  assert.match(html.headers.get('content-type'), /^text\/html/)
  const page = await html.text()
  assert.match(page, /Vueforge SSR error/)
  assert.match(page, /src\/App\.vue:2:10/)
  assert.match(page, /vite:vue/)
  assert.match(page, /Vite frame/)
  assert.match(page, /Source/)
  assert.match(page, /Stack trace/)

  const json = await fetch(origin + '?error=json', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  assert.equal(json.status, 500)
  assert.deepEqual((await json.json()).details, {
    name: 'SyntaxError',
    message: 'Unexpected token',
    file: 'src/App.vue',
    line: 2,
    column: 10,
    plugin: 'vite:vue',
    frame: error.frame,
    source:
      '     1 | <template>\n>    2 |   <main>{{ broken }}</main>\n     3 | </template>\n     4 | ',
    stack: error.stack,
  })
})

test('production render errors remain generic', async (t) => {
  const server = express()
    .use(
      '/render',
      renderRoute(
        async () => {
          throw new Error('secret component detail')
        },
        { interruptible: true },
      ),
    )
    .listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await once(server, 'listening')

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/render?error=html`,
    {
      method: 'POST',
      headers: { accept: 'text/html', 'content-type': 'application/json' },
      body: '{}',
    },
  )
  assert.equal(response.status, 500)
  assert.match(response.headers.get('content-type'), /^application\/json/)
  assert.deepEqual(await response.json(), {
    error:
      'Vue SSR failed. Check the Vueforge server log for the component error.',
  })
})
