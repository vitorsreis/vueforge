import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'

import {
  createCorsMiddleware,
  viteCorsOptions,
} from '../dist/server/http/cors.js'

const { fetch } = globalThis

async function listen(app, t) {
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

test('allows all origins and handles preflight by default', async (t) => {
  const app = express()
  app.use(createCorsMiddleware(undefined))
  app.get('/healthz', (_request, response) => response.json({ status: 'ok' }))
  app.options('/render', (_request, response) => response.status(500).end())
  const origin = await listen(app, t)

  const response = await fetch(origin + '/healthz', {
    headers: { Origin: 'https://client.example' },
  })
  assert.equal(response.headers.get('access-control-allow-origin'), '*')

  const preflight = await fetch(origin + '/render', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://client.example',
      'Access-Control-Request-Method': 'POST',
    },
  })
  assert.equal(preflight.status, 204)
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/)
})

test('supports explicit origins and credentials', async (t) => {
  const app = express()
  app.use(
    createCorsMiddleware({
      origin: ['https://allowed.example'],
      credentials: true,
    }),
  )
  app.get('/healthz', (_request, response) => response.json({ status: 'ok' }))
  const origin = await listen(app, t)

  const allowed = await fetch(origin + '/healthz', {
    headers: { Origin: 'https://allowed.example' },
  })
  assert.equal(
    allowed.headers.get('access-control-allow-origin'),
    'https://allowed.example',
  )
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true')

  const denied = await fetch(origin + '/healthz', {
    headers: { Origin: 'https://denied.example' },
  })
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
})

test('maps the shared CORS setting to Vite and supports string options', async (t) => {
  assert.equal(viteCorsOptions(undefined), true)
  assert.deepEqual(viteCorsOptions(['https://client.example']), {
    origin: ['https://client.example'],
  })
  assert.equal(viteCorsOptions(false), false)

  const app = express()
  app.use(
    createCorsMiddleware({
      origin: '*',
      methods: 'GET, POST',
      allowedHeaders: 'content-type',
      exposedHeaders: 'x-render-time',
      optionsSuccessStatus: 200,
    }),
  )
  app.get('/healthz', (_request, response) => response.json({ status: 'ok' }))
  const origin = await listen(app, t)

  const response = await fetch(origin + '/healthz', {
    headers: { Origin: 'https://client.example' },
  })
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  assert.equal(
    response.headers.get('access-control-expose-headers'),
    'x-render-time',
  )

  const preflight = await fetch(origin + '/healthz', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://client.example',
      'Access-Control-Request-Method': 'POST',
    },
  })
  assert.equal(preflight.status, 200)
  assert.equal(
    preflight.headers.get('access-control-allow-methods'),
    'GET, POST',
  )
  assert.equal(
    preflight.headers.get('access-control-allow-headers'),
    'content-type',
  )
})

test('does not reflect arbitrary origins when credentials are enabled', async (t) => {
  const app = express()
  app.use(createCorsMiddleware({ credentials: true }))
  app.get('/healthz', (_request, response) => response.json({ status: 'ok' }))
  const origin = await listen(app, t)

  const response = await fetch(origin + '/healthz', {
    headers: { Origin: 'https://untrusted.example' },
  })
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('accepts regular-expression origins in the configuration object', async (t) => {
  const app = express()
  app.use(createCorsMiddleware({ origin: /^https:\/\/client\.example$/ }))
  app.get('/healthz', (_request, response) => response.json({ status: 'ok' }))
  const origin = await listen(app, t)

  const response = await fetch(origin + '/healthz', {
    headers: { Origin: 'https://client.example' },
  })
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'https://client.example',
  )
})
