import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'

import { createRenderHandler } from '../dist/server/render-handler.js'

const render = async (props) => ({
  content: `<h1>${props?.title ?? 'Default'}</h1>`,
  teleportHead: '',
  assets: [],
})

test('framework-neutral render handler returns successful responses', async () => {
  const handle = createRenderHandler(render)
  const response = await handle({ body: { props: { title: 'Hello' } } })

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    head: [],
    content: '<h1>Hello</h1>',
  })
})

test('framework-neutral render handler maps input errors', async () => {
  const handle = createRenderHandler(render)
  const response = await handle({ body: { props: [] } })

  assert.equal(response.status, 400)
  assert.match(response.body.error, /props.*JSON object/i)
})

test('negotiates JSON by default and HTML by Accept quality', async () => {
  const handle = createRenderHandler(render)

  const json = await handle({ body: {}, accept: 'application/json' })
  assert.equal(json.status, 200)
  assert.match(json.headers['Content-Type'], /^application\/json/)
  assert.deepEqual(json.body, { head: [], content: '<h1>Default</h1>' })

  const html = await handle({
    body: {},
    accept: 'application/json;q=0.2, text/html;q=0.9',
  })
  assert.equal(html.status, 200)
  assert.match(html.headers['Content-Type'], /^text\/html/)
  assert.match(html.body, /^<!doctype html>/)
})

test('returns 406 when Accept excludes supported formats', async () => {
  const handle = createRenderHandler(render)
  const response = await handle({ body: {}, accept: 'application/xml' })

  assert.equal(response.status, 406)
  assert.equal(response.headers.Vary, 'Accept')
})

test('framework-neutral render handler keeps development diagnostics adapter-independent', async () => {
  const root = process.cwd()
  const error = Object.assign(new Error('broken component'), {
    id: `${root}/src/App.vue`,
    loc: { line: 2, column: 3 },
  })
  const handle = createRenderHandler(
    async () => {
      throw error
    },
    { development: true, interruptible: true, root },
  )

  const response = await handle({ body: {}, errorFormat: 'json' })
  assert.equal(response.status, 500)
  assert.equal(response.body.error, 'broken component')
  assert.equal(response.body.details.line, 2)
})
