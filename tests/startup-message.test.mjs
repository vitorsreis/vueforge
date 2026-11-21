import assert from 'node:assert/strict'
import test from 'node:test'

import { formatStartupMessage } from '../dist/server/startup-message.js'

const base = {
  protocol: 'http',
  address: '127.0.0.1:9901',
  mode: 'development',
}

test('describes the active mode and component main source', () => {
  assert.equal(
    formatStartupMessage(
      base,
      {},
      {
        kind: 'component',
        template: { kind: 'component', url: '/src/App.vue' },
      },
    ),
    'Vueforge listening on http://127.0.0.1:9901 in development mode with main component "src/App.vue".',
  )
})

test('describes directory, pattern, and named catalog sources', () => {
  assert.match(
    formatStartupMessage(
      base,
      { main: 'src/pages' },
      {
        kind: 'templates',
        templates: { home: { kind: 'component', url: '/src/pages/home.vue' } },
      },
    ),
    /in development mode from directory "src\/pages"\./,
  )
  assert.match(
    formatStartupMessage(
      base,
      { main: /\.page\.vue$/ },
      {
        kind: 'templates',
        templates: { home: { kind: 'component', url: '/src/home.page.vue' } },
      },
    ),
    /from pattern "\/\\.page\\.vue\$\/"\./,
  )
  assert.match(
    formatStartupMessage(
      base,
      { main: { home: 'src/home.vue' } },
      {
        kind: 'templates',
        templates: { home: { kind: 'component', url: '/src/home.vue' } },
      },
    ),
    /with named template catalog \(1 template\)\./,
  )
})

test('describes entry and direct factory sources', () => {
  assert.match(
    formatStartupMessage(base, {}, { kind: 'entry', url: '/src/entry.ts' }),
    /with main entry "src\/entry\.ts"\./,
  )
  assert.match(
    formatStartupMessage(
      base,
      {},
      { kind: 'factory', configFile: 'C:/project/vueforge.config.ts' },
    ),
    /with main factory\./,
  )
})
