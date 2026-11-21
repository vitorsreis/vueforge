import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import console from 'node:console'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { Agent, request } from 'node:http'
import { createServer } from 'node:net'
import { availableParallelism, cpus, version } from 'node:os'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, URL } from 'node:url'
import { promisify } from 'node:util'

const { AbortSignal } = globalThis
const host = '127.0.0.1'
const warmupRequests = 10
const measuredRequests = 5000
const cli = fileURLToPath(new URL('../bin/vueforge', import.meta.url))
const example = new URL('../examples/basic/src/', import.meta.url)
const scratch = fileURLToPath(new URL('../.vueforge', import.meta.url))
const env = { ...process.env, NODE_ENV: 'production' }
const run = promisify(execFile)

async function availablePort() {
  // shortcut: the CLI accepts fixed ports, use an OS-assigned port directly if it gains port 0 support.
  const socket = createServer()
  socket.listen(0, host)
  await once(socket, 'listening')
  const { port } = socket.address()
  await socket[Symbol.asyncDispose]()
  return port
}

async function render(port, agent, title, deadline) {
  const body = JSON.stringify({ props: { title } })
  const signal = AbortSignal.any([deadline, AbortSignal.timeout(5000)])
  const start = performance.now()
  const post = request({
    host,
    port,
    path: '/render',
    method: 'POST',
    agent,
    signal,
    headers: {
      'content-type': 'application/json',
      'content-length': body.length,
    },
  })
  const received = once(post, 'response')
  post.end(body)
  const [response] = await received
  let payload = ''
  for await (const chunk of response.setEncoding('utf8')) payload += chunk
  const elapsed = performance.now() - start

  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-type'], /^application\/json\b/)
  assert.deepEqual(JSON.parse(payload), {
    head: [],
    content: `<h1>${title}</h1>`,
  })
  return elapsed
}

async function sample(port, agent, concurrency, count, phase) {
  const deadline = AbortSignal.timeout(30000)
  const timings = []
  await Promise.all(
    Array.from({ length: concurrency }, async (_, worker) => {
      for (let index = worker; index < count; index += concurrency) {
        const title = `VueForge ${concurrency} ${phase} ${index + 1}`
        timings.push(await render(port, agent, title, deadline))
      }
    }),
  )
  return timings
}

async function benchmark(port, concurrency) {
  const agent = new Agent({ keepAlive: true, maxSockets: concurrency })
  try {
    await sample(port, agent, concurrency, warmupRequests, 'warmup')
    const start = performance.now()
    const timings = await sample(
      port,
      agent,
      concurrency,
      measuredRequests,
      'sample',
    )
    const elapsed = performance.now() - start
    timings.sort((a, b) => a - b)
    const percentile = (fraction) =>
      timings[Math.ceil(timings.length * fraction) - 1]
    return {
      concurrency,
      warmup: warmupRequests,
      requests: timings.length,
      'elapsed (ms)': elapsed.toFixed(2),
      'requests/s': ((timings.length * 1000) / elapsed).toFixed(2),
      'p50 (ms)': percentile(0.5).toFixed(2),
      'p95 (ms)': percentile(0.95).toFixed(2),
    }
  } finally {
    agent.destroy()
  }
}

await mkdir(scratch, { recursive: true })
const cwd = await mkdtemp(join(scratch, 'bench-render-'))
assert.equal(dirname(cwd), scratch)
try {
  await cp(example, join(cwd, 'src'), { recursive: true })
  await run(process.execPath, [cli, 'build'], { cwd, env, timeout: 60000 })

  const port = await availablePort()
  const child = spawn(
    process.execPath,
    [cli, 'serve', '--host', host, '--port', String(port)],
    { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const closed = new Promise((resolve) => child.once('close', resolve))
  let log = ''
  child.on('error', (error) => {
    log += error.message
  })
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8').on('data', (chunk) => {
      log += chunk
    })
  }
  try {
    const origin = `http://${host}:${port}`
    const deadline = Date.now() + 15000
    while (!log.includes(`VueForge listening on ${origin}`)) {
      assert.ok(
        child.pid && child.exitCode === null && Date.now() < deadline,
        'Production server startup failed.\n' + log,
      )
      await delay(25)
    }

    console.log(
      `Node ${process.version} | ${version()} ${process.arch} | ${cpus()[0]?.model ?? 'Unknown CPU'} | ${availableParallelism()} available logical CPUs`,
    )
    console.log(
      `POST ${origin}/render | examples/basic/src/App.vue | production | HTTP keep-alive`,
    )
    const results = []
    for (const concurrency of [1, 2, 4])
      results.push(await benchmark(port, concurrency))
    console.table(results)
  } finally {
    child.kill()
    await closed
  }
} finally {
  await rm(cwd, { recursive: true, force: true, maxRetries: 3 })
}
