import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { execPath } from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, URL } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

const { fetch, AbortSignal } = globalThis

const cli = fileURLToPath(new URL('../bin/vueforge', import.meta.url))
const example = new URL('../examples/basic/src/', import.meta.url)
const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))
const run = promisify(execFile)

async function availablePort() {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  )
  return port
}

function post(url, body) {
  return fetch(url + '/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: AbortSignal.timeout(5000),
  })
}

async function checkRenderResponses(url) {
  const page = await fetch(url, { signal: AbortSignal.timeout(5000) })
  assert.equal(page.status, 200)
  assert.match(page.headers.get('content-type'), /^application\/json\b/)
  assert.deepEqual(await page.json(), {
    message: 'Welcome to VueForge!',
    repository: 'https://github.com/vitorsreis/vueforge',
    poweredBy: 'Vitor Reis',
  })

  for (const [body, status, message] of [
    ['{', 400, /JSON object/],
    ['{"format":"xml"}', 400, /format/],
    ['{"hydrate":1}', 400, /hydrate/],
    ['[]', 400, /request body.*object/i],
    ['{"props":[]}', 400, /"props" must be a JSON object/],
    [JSON.stringify({ title: 'x'.repeat(65536) }), 413, /64 KiB/],
  ]) {
    const response = await post(url, body)
    assert.equal(response.status, status)
    assert.match((await response.json()).error, message)
  }

  await Promise.all(
    ['First', 'Second'].map(async (title) => {
      const response = await post(url, JSON.stringify({ props: { title } }))
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        head: '',
        content: '<h1>' + title + '</h1>',
      })
    }),
  )
}

async function checkComponentReload(cwd, url) {
  const file = join(cwd, 'src/App.vue')
  await writeFile(file, (await readFile(file, 'utf8')).replaceAll('h1', 'h2'))
  const deadline = Date.now() + 10000
  for (;;) {
    const response = await post(url, '{}')
    assert.equal(response.status, 200)
    if ((await response.json()).content === '<h2>VueForge</h2>') break
    assert.ok(Date.now() < deadline, 'SSR did not pick up the SFC edit')
    await delay(50)
  }
}

for (const mode of [
  'development',
  'production',
  'production with custom tempDir',
]) {
  test(`CLI renders HTTP requests in ${mode}`, { timeout: 60000 }, async () => {
    await mkdir(scratch, { recursive: true })
    const cwd = await mkdtemp(join(scratch, 'cli-test-'))
    try {
      await cp(example, join(cwd, 'src'), { recursive: true })
      await mkdir(join(cwd, 'public'))
      await writeFile(join(cwd, 'public/index.html'), '<p>Project page</p>')
      const dev = mode === 'development'
      const port = await availablePort()
      const url = 'http://127.0.0.1:' + port

      // An invalid bind address makes ignoring the development CLI override observable.
      const config = dev
        ? { host: 'invalid.invalid', port: 1 }
        : { host: '127.0.0.1', port }
      if (mode === 'production with custom tempDir') {
        config.tempDir = 'cache/render output'
      }
      await writeFile(
        join(cwd, 'vueforge.config.ts'),
        'export default ' + JSON.stringify(config),
      )

      if (!dev) {
        await assert.rejects(
          run(execPath, [cli, 'serve'], { cwd, timeout: 10000 }),
          {
            code: 1,
            stderr: /vueforge build/,
          },
        )
        await run(execPath, [cli, 'build'], { cwd, timeout: 30000 })
        const output = join(cwd, config.tempDir ?? '.vueforge')
        await access(join(output, 'client/.vite/manifest.json'))
        await access(join(output, 'server/entry.mjs'))
        await rm(join(cwd, 'src/App.vue'))
      }

      const args = dev
        ? ['--dev', '--port', String(port), '--host', '127.0.0.1']
        : []
      const child = spawn(execPath, [cli, 'serve', ...args], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const closed = once(child, 'close')
      let log = ''
      for (const stream of [child.stdout, child.stderr]) {
        stream.setEncoding('utf8').on('data', (chunk) => {
          log += chunk
        })
      }
      try {
        const deadline = Date.now() + 15000
        while (!log.includes(url)) {
          assert.ok(
            child.exitCode === null && Date.now() < deadline,
            'Startup failed: ' + log,
          )
          await delay(50)
        }

        const health = await fetch(url + '/healthz', {
          signal: AbortSignal.timeout(5000),
        })
        assert.equal(health.status, 200)
        assert.equal(health.headers.get('cache-control'), 'no-store')
        assert.deepEqual(await health.json(), { status: 'ok' })

        await checkRenderResponses(url)

        if (dev) {
          await checkComponentReload(cwd, url)
        }
      } finally {
        child.kill()
        await closed
      }
    } finally {
      await rm(cwd, { recursive: true, force: true, maxRetries: 3 })
    }
  })
}
