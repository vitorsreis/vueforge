import assert from 'node:assert/strict'
import test from 'node:test'

import { RenderInputError, parseRenderRequest } from '../dist/render/request.js'
import { formatRenderResponse, renderResponse } from '../dist/render/result.js'

test('validates and defaults the shared render request fields', () => {
  assert.deepEqual(parseRenderRequest({}), { format: 'json', hydrate: false })
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
    head: [
      {
        tag: 'meta',
        attrs: { name: 'description', content: 'Teleported' },
      },
      css,
    ],
    content: '<h1>Hi</h1>',
  })
})

test('parses Teleport head tags without losing nested content', () => {
  const result = renderResponse(
    {
      teleportHead:
        '<!--teleport start anchor-->' +
        '<title>Orders</title>' +
        '<script type="application/ld+json">{"@type":"WebPage"}</script>' +
        '<!--teleport anchor-->',
      assets: [],
      content: '<main>Orders</main>',
    },
    { format: 'json', hydrate: false },
  )

  assert.deepEqual(result.head, [
    { tag: 'title', attrs: {}, content: 'Orders' },
    {
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      content: '{"@type":"WebPage"}',
    },
  ])
})

test('preserves Teleport anchors only for hydration', () => {
  const result = {
    teleportHead:
      '<!--teleport start anchor--><title>Orders</title><!--teleport anchor-->',
    assets: [],
    content: '<main>Orders</main>',
  }

  const hydrated = renderResponse(result, { format: 'json', hydrate: true })
  assert.deepEqual(hydrated.head.slice(0, 3), [
    { html: '<!--teleport start anchor-->' },
    { tag: 'title', attrs: {}, content: 'Orders' },
    { html: '<!--teleport anchor-->' },
  ])
})

test('removes Vue SSR markers from non-hydrated content', () => {
  const result = renderResponse(
    {
      teleportHead:
        '<!--teleport start anchor--><title>Orders</title><!--teleport anchor-->',
      assets: [],
      content:
        '<!--[--><!--teleport start--><!--teleport end--><main>Orders</main><!--]-->',
    },
    { format: 'json', hydrate: false },
  )

  assert.deepEqual(result, {
    head: [{ tag: 'title', attrs: {}, content: 'Orders' }],
    content: '<main>Orders</main>',
  })
})

test('formats JSON and HTML using the same structured head entries', () => {
  const result = {
    teleportHead: '<title>Orders</title>',
    assets: [
      { tag: 'script', attrs: { type: 'module', src: '/@vite/client' } },
      { tag: 'script', attrs: { type: 'module', src: '/@vueforge/client' } },
    ],
    content: '<main>Orders</main>',
  }

  const json = formatRenderResponse(
    result,
    {
      format: 'json',
      hydrate: false,
    },
    { development: true },
  )
  assert.equal(json.format, 'json')
  assert.deepEqual(json.body.head, [
    { tag: 'title', attrs: {}, content: 'Orders' },
    { tag: 'script', attrs: { type: 'module', src: '/@vite/client' } },
    { tag: 'script', attrs: { type: 'module', src: '/@vueforge/client' } },
  ])

  const html = formatRenderResponse(
    result,
    { format: 'html', hydrate: false },
    {
      development: true,
      document: {
        htmlAttrs: { lang: 'pt-BR' },
        rootId: 'app-root',
      },
    },
  )
  assert.equal(html.format, 'html')
  assert.match(html.body, /^<!doctype html>/)
  assert.match(html.body, /<html lang="pt-BR">/)
  assert.match(html.body, /<title>Orders<\/title>/)
  assert.match(
    html.body,
    /<script type="module" src="\/@vite\/client"><\/script>/,
  )
  assert.match(html.body, /<div id="app-root"><main>Orders<\/main><\/div>/)
})

test('renders a configured document around the response fragments', async () => {
  const { renderDocument } = await import('../dist/render/document.js')

  assert.equal(
    renderDocument(
      [{ tag: 'title', attrs: {}, content: 'Orders' }],
      '<main>Orders</main>',
      {
        htmlAttrs: { lang: 'pt-BR' },
        bodyAttrs: { class: 'app' },
        rootId: 'vue',
        head: [
          {
            tag: 'meta',
            attrs: { charset: 'utf-8' },
          },
        ],
      },
    ),
    '<!doctype html>\n' +
      '<html lang="pt-BR">\n' +
      '  <head><meta charset="utf-8"><title>Orders</title></head>\n' +
      '  <body class="app">\n' +
      '    <div id="vue"><main>Orders</main></div>\n' +
      '  </body>\n' +
      '</html>\n',
  )
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
