import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

import express from 'express'

import { renderRoute } from '../dist/server/render/route.js'

const { AbortSignal, fetch } = globalThis

test('a timed-out development render holds its slot until it settles', async (t) => {
  const started = Promise.withResolvers()
  const finished = Promise.withResolvers()
  const result = { content: '<p>Rendered</p>', teleportHead: '', assets: [] }
  const server = express()
    .use(
      '/render',
      renderRoute(
        async (props) => {
          if (props?.defer) {
            started.resolve()
            await finished.promise
          }
          return result
        },
        { timeoutMs: 150, maxConcurrent: 1 },
      ),
    )
    .listen(0, '127.0.0.1')
  t.after(async () => {
    finished.resolve()
    await new Promise((resolve) => server.close(resolve))
  })
  await once(server, 'listening')
  const post = (body) =>
    fetch(`http://127.0.0.1:${server.address().port}/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })

  const pending = post({ props: { defer: true } })
  // A timeout in the client must still be observed if an assertion fails first.
  pending.catch(() => {})
  await started.promise
  const overloaded = await post({})
  assert.equal(overloaded.status, 503)
  assert.equal(overloaded.headers.get('retry-after'), '1')
  assert.equal((await pending).status, 504)
  const stillOverloaded = await post({})
  assert.equal(stillOverloaded.status, 503)

  finished.resolve()
  const response = await post({})
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { head: [], content: result.content })
})

test('production can replace a worker after a synchronous render overruns its deadline', async (t) => {
  const { productionWorkerRenderer } =
    await import('../dist/server/production/worker-renderer.js')
  const root = await mkdtemp(join(tmpdir(), 'Vueforge-worker-test-'))
  const entry = join(root, 'entry.mjs')
  await writeFile(
    entry,
    `import { threadId } from 'node:worker_threads'
    export async function render(props, context) {
      if (props?.defer) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_200)
      if (props?.oversized) return { content: '\u00e9'.repeat(12), teleportHead: '123456789', modules: [] }
      return { content: threadId + ':' + context.value, teleportHead: '', modules: [] }
    }`,
  )
  let renderer
  t.after(async () => {
    await renderer?.close()
    await rm(root, { recursive: true, force: true })
  })
  renderer = await productionWorkerRenderer(pathToFileURL(entry), {
    renderTimeoutMs: 500,
    maxConcurrentRenders: 1,
    maxOutputBytes: 32,
  })
  await assert.rejects(renderer.render({ oversized: true }), /output limit/)
  const first = await renderer.render({}, { value: 'first' })
  assert.match(first.content, /^[1-9]\d*:first$/)
  const pending = renderer.render({ defer: true }, { value: 'late' })
  await assert.rejects(renderer.render({}, { value: 'excess' }), {
    name: 'RenderBusyError',
  })
  await assert.rejects(pending, { name: 'RenderTimeoutError' })

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const next = await renderer.render({}, { value: 'next' })
      assert.match(next.content, /^[1-9]\d*:next$/)
      assert.notEqual(next.content.split(':')[0], first.content.split(':')[0])
      return
    } catch (error) {
      if (error.name !== 'RenderBusyError') throw error
      await delay(100)
    }
  }
  assert.fail('Vueforge did not replace the timed-out worker')
})
