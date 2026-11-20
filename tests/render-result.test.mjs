import assert from 'node:assert/strict'
import test from 'node:test'

import { RenderInputError, parseRenderRequest } from '../dist/render/request.js'
import { renderResponse } from '../dist/render/result.js'

test('validates and defaults the shared render request fields', () => {
  assert.deepEqual(parseRenderRequest({}), { format: 'html', hydrate: false })
  assert.deepEqual(
    parseRenderRequest({
      format: 'json',
      hydrate: true,
      props: { title: 'Hi' },
    }),
    { format: 'json', hydrate: true, props: { title: 'Hi' } },
  )

  for (const [input, message] of [
    [null, /request body must be a JSON object/],
    [{ props: [] }, /"props" must be a JSON object/],
    [{ format: null }, /"format"/],
    [{ hydrate: 'true' }, /"hydrate"/],
  ]) {
    assert.throws(() => parseRenderRequest(input), {
      name: RenderInputError.name,
      message,
    })
  }
})

const teleportHead = '<meta name="description" content="Teleported">'
const css = { tag: 'link', attrs: { rel: 'stylesheet', href: '/main.css' } }
const script = { tag: 'script', attrs: { type: 'module', src: '/app.js' } }

test('returns teleported HTML and CSS in both formats without hydration', () => {
  const result = {
    teleportHead,
    assets: [css, script],
    content: '<h1>Hi</h1>',
  }
  const request = { hydrate: false }

  assert.deepEqual(renderResponse(result, { ...request, format: 'html' }), {
    head: `${teleportHead}<link rel="stylesheet" href="/main.css">`,
    content: '<h1>Hi</h1>',
  })
  assert.deepEqual(renderResponse(result, { ...request, format: 'json' }), {
    head: [{ html: teleportHead }, css],
    content: '<h1>Hi</h1>',
  })
})

test('encodes raw text safely and places hydration data before the module', () => {
  const props = { title: '</sCrIpT><!--<script>&' }
  const style = {
    tag: 'style',
    attrs: { 'data-vite-dev-id': '/src/a.css?x="a"&y=<value>' },
    content: '.a::after { content: "</sTyLe>"; }',
  }
  const result = {
    teleportHead: '',
    assets: [style, script],
    content: '<main></main>',
  }
  const html = renderResponse(result, { format: 'html', hydrate: true, props })
  const json = renderResponse(result, { format: 'json', hydrate: true, props })
  const [styleEntry, propsEntry, scriptEntry] = json.head

  assert.deepEqual(styleEntry, {
    ...style,
    content: '.a::after { content: "<\\/sTyLe>"; }',
  })
  assert.deepEqual(propsEntry.attrs, {
    type: 'application/json',
    id: 'vueforge-props',
  })
  assert.equal(propsEntry.tag, 'script')
  assert.doesNotMatch(propsEntry.content, /</)
  assert.deepEqual(JSON.parse(propsEntry.content), props)
  assert.deepEqual(scriptEntry, script)
  assert.equal(
    html.head,
    '<style data-vite-dev-id="/src/a.css?x=&quot;a&quot;&amp;y=&lt;value&gt;">' +
      '.a::after { content: "<\\/sTyLe>"; }</style>' +
      `<script type="application/json" id="vueforge-props">${propsEntry.content}</script>` +
      '<script type="module" src="/app.js"></script>',
  )
})
