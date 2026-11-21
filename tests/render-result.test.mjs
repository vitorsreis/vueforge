import assert from 'node:assert/strict'
import test from 'node:test'

import { RenderInputError, parseRenderRequest } from '../dist/render/request.js'
import { formatRenderResponse, renderResponse } from '../dist/render/result.js'

test('treats the complete body as request context and controls rendering from options', () => {
  assert.deepEqual(parseRenderRequest({}), {
    format: 'json',
    hydrate: false,
    context: {},
  })
  assert.deepEqual(
    parseRenderRequest({ props: { title: 'Hi' }, locale: 'pt-BR' }, 'json', {
      hydrate: true,
      template: 'home',
    }),
    {
      format: 'json',
      hydrate: true,
      template: 'home',
      context: { props: { title: 'Hi' }, locale: 'pt-BR' },
    },
  )
  assert.throws(() => parseRenderRequest(null), { name: RenderInputError.name })
})

test('parses Teleport head tags and removes Vue markers without hydration', () => {
  const result = renderResponse(
    {
      teleportHead:
        '<!--teleport start anchor--><title>Orders</title><!--teleport anchor-->',
      assets: [],
      content:
        '<!--[--><!--teleport start--><!--teleport end--><main>Orders</main><!--]-->',
      context: {},
    },
    { format: 'json', hydrate: false, context: {} },
  )
  assert.deepEqual(result, {
    head: [{ tag: 'title', attrs: {}, content: 'Orders' }],
    content: '<main>Orders</main>',
  })
})

test('emits one complete hydration payload and preserves anchors', () => {
  const result = renderResponse(
    {
      teleportHead:
        '<!--teleport start anchor--><title>Orders</title><!--teleport anchor-->',
      assets: [{ tag: 'script', attrs: { type: 'module', src: '/app.js' } }],
      content: '<main>Orders</main>',
      context: { props: { title: 'Orders' }, state: { count: 1 } },
    },
    { format: 'json', hydrate: true, context: { props: { title: 'Orders' } } },
  )
  assert.deepEqual(result.head.slice(0, 3), [
    { html: '<!--teleport start anchor-->' },
    { tag: 'title', attrs: {}, content: 'Orders' },
    { html: '<!--teleport anchor-->' },
  ])
  const payload = result.head.find(({ attrs }) => attrs?.id === '__VUEFORGE__')
  assert.ok(payload)
  assert.deepEqual(JSON.parse(payload.content), {
    context: { props: { title: 'Orders' }, state: { count: 1 } },
  })
  assert.deepEqual(result.state, { count: 1 })
})

test('formats development assets in JSON and HTML', () => {
  const result = {
    teleportHead: '<title>Orders</title>',
    assets: [
      { tag: 'script', attrs: { type: 'module', src: '/@vite/client' } },
      { tag: 'script', attrs: { type: 'module', src: '/@vueforge/client' } },
    ],
    content: '<main>Orders</main>',
    context: {},
  }
  const json = formatRenderResponse(
    result,
    { format: 'json', hydrate: false, context: {} },
    { development: true },
  )
  assert.deepEqual(json.body.head, [
    { tag: 'title', attrs: {}, content: 'Orders' },
    result.assets[0],
    result.assets[1],
  ])
  const html = formatRenderResponse(
    result,
    { format: 'html', hydrate: false, context: {} },
    { development: true },
  )
  assert.match(html.body, /<title>Orders<\/title>/)
  assert.match(html.body, /<div id="app"><main>Orders<\/main><\/div>/)
})
