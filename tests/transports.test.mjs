import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { PassThrough } from 'node:stream'
import { createServer } from 'node:http'
import { lstat, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import test from 'node:test'

import {
  closeHttpServer,
  listenHttpServer,
  UnixSocketExistsError,
  validateTransportSelection,
} from '../dist/server/transports/http.js'
import { serveStdio } from '../dist/server/transports/stdio.js'

test('validates mutually exclusive server transports', () => {
  assert.throws(
    () => validateTransportSelection({ stdio: true, unix: 'server.sock' }),
    /stdio and Unix transports cannot be used together/,
  )
  assert.throws(
    () =>
      validateTransportSelection({
        host: '127.0.0.1',
        port: 9901,
        unix: 'server.sock',
      }),
    /Unix transport cannot be used with host or port/,
  )
  assert.doesNotThrow(() =>
    validateTransportSelection({ host: '127.0.0.1', port: 9901 }),
  )
})

test('listens and closes a TCP transport', async () => {
  const server = createServer((_request, response) => {
    response.end('ok')
  })

  const listening = await listenHttpServer(server, {
    kind: 'tcp',
    host: '127.0.0.1',
    port: 0,
  })
  assert.equal(server.listening, true)
  assert.equal(listening.transport.kind, 'tcp')
  await closeHttpServer(server, listening)
  assert.equal(server.listening, false)
})

test('owns and cleans a Unix socket without deleting a replaced path', async (t) => {
  if (process.platform === 'win32') return

  const root = await mkdtemp(join(process.cwd(), '.vueforge', 'transport-'))
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }))
  const path = join(root, 'server.sock')
  const server = createServer((_request, response) => {
    response.end('ok')
  })

  const listening = await listenHttpServer(server, { kind: 'unix', path })
  assert.equal((await lstat(path)).isSocket(), true)
  if (process.platform !== 'win32') {
    assert.equal((await stat(path)).mode & 0o777, 0o600)
  }
  await closeHttpServer(server, listening)
  await assert.rejects(lstat(path), { code: 'ENOENT' })

  await writeFile(path, 'preserve')
  const second = createServer()
  await assert.rejects(
    listenHttpServer(second, { kind: 'unix', path }),
    UnixSocketExistsError,
  )
  await new Promise((resolve) => second.close(resolve))
})

test('serves newline-delimited JSON through stdio and continues after errors', async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const chunks = []
  output.on('data', (chunk) => chunks.push(chunk))

  const running = serveStdio({
    input,
    output,
    handle: async (body) => {
      if (typeof body !== 'object' || body === null || Array.isArray(body))
        throw new Error('Request must be an object.')
      const props = body.props
      if (typeof props !== 'object' || props === null || Array.isArray(props))
        throw new Error('Props must be an object.')
      return { ok: true, title: props.title ?? 'Default' }
    },
  })

  input.write('{"props":{"title":"First"}}\n')
  input.write('{bad}\n')
  input.write('\n')
  input.write('{"props":{"title":"Second"}}\n')
  input.end()
  await running

  const lines = Buffer.concat(chunks).toString('utf8').trim().split('\n')
  const parsed = lines.map((line) => JSON.parse(line))
  assert.deepEqual(parsed[0], { ok: true, title: 'First' })
  assert.equal(parsed[1].error, 'Send one valid JSON request per line.')
  assert.deepEqual(parsed[2], { ok: true, title: 'Second' })
})

test('rejects oversized stdio lines and continues with the next request', async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  const chunks = []
  output.on('data', (chunk) => chunks.push(chunk))

  const running = serveStdio({
    input,
    output,
    maxRequestBytes: 16,
    handle: async () => ({ ok: true }),
  })

  input.write('xxxxxxxxxxxxxxxxx\n')
  input.end('{}\n')
  await running

  const lines = Buffer.concat(chunks).toString('utf8').trim().split('\n')
  assert.equal(JSON.parse(lines[0]).error, 'Request line exceeds 16 bytes.')
  assert.deepEqual(JSON.parse(lines[1]), { ok: true })
})
