import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { access, cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { argv, env, execPath, versions } from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, URL } from 'node:url'

const { AbortSignal, console, fetch } = globalThis
const root = fileURLToPath(new URL('../', import.meta.url))
const npm = env.npm_execpath
const [archive, ...extra] = argv.slice(2)

assert.ok(
  Number.parseInt(versions.node, 10) >= 24,
  'Qualification requires Node.js 24 or newer',
)
assert.ok(npm, 'Run npm run test:qualification')
assert.ok(
  extra.length === 0 && (!archive || extname(archive) === '.tgz'),
  'Pass at most one package tarball (.tgz)',
)

function run(script, args, cwd, input) {
  const result = spawnSync(execPath, [script, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout: 120000,
  })
  assert.ifError(result.error)
  assert.equal(
    result.status,
    0,
    `${args.join(' ')} failed\n${result.stdout}${result.stderr}`,
  )
  return result.stdout
}

async function verifyServer(cli, cwd, body, expected) {
  const socket = createServer().listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  const socketClosed = once(socket, 'close')
  socket.close()
  await socketClosed
  const url = `http://127.0.0.1:${port}`
  const child = spawn(execPath, [cli, 'serve', '--port', String(port)], {
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
      assert.ok(child.exitCode === null && Date.now() < deadline, log)
      await delay(50)
    }
    const response = await fetch(url + '/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5000),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), expected)
  } finally {
    child.kill()
    await closed
  }
}

const temp = await mkdtemp(join(tmpdir(), 'Vueforge-qualification-'))
try {
  const tarball = archive
    ? resolve(archive)
    : join(
        temp,
        JSON.parse(
          run(npm, ['pack', '--json', '--pack-destination', temp], root),
        )[0].filename,
      )
  const cwd = join(temp, 'consumer')
  await mkdir(cwd)
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  )
  run(
    npm,
    [
      'install',
      '--omit=dev',
      '--ignore-scripts',
      '--prefer-offline',
      '--no-audit',
      '--no-fund',
      tarball,
    ],
    cwd,
  )

  await writeFile(
    join(cwd, 'consumer.ts'),
    "import { createVueforgeRenderer, type VueforgeRendererOptions } from '@vitorsreis/vueforge'\nconst options: VueforgeRendererOptions = { mode: 'production' }\nvoid createVueforgeRenderer(options)\n",
  )
  run(
    join(root, 'node_modules/typescript7/bin/tsc'),
    [
      '--noEmit',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2024',
      '--skipLibCheck',
      join(cwd, 'consumer.ts'),
    ],
    cwd,
  )

  assert.match(
    run(npm, ['exec', '--offline', '--no', '--', 'vueforge', '--help'], cwd),
    /vueforge build/,
  )
  const cli = join(cwd, 'node_modules/@vitorsreis/vueforge/bin/vueforge')
  await cp(
    new URL('../examples/basic/src/', import.meta.url),
    join(cwd, 'src'),
    {
      recursive: true,
    },
  )
  await writeFile(
    join(cwd, 'vueforge.config.ts'),
    "import { defineConfig } from '@vitorsreis/vueforge'\nexport default defineConfig({ tempDir: '.vueforge', build: { outDir: 'build' } })\n",
  )

  run(cli, ['build'], cwd)
  await access(join(cwd, 'build/client/.vite/manifest.json'))
  await access(join(cwd, 'build/server/entry.mjs'))
  await rm(join(cwd, 'src/App.vue'))
  const body = JSON.stringify({ props: { title: 'Packed <Vue>' } })
  const expected = { head: [], content: '<h1>Packed &lt;Vue&gt;</h1>' }
  assert.deepEqual(JSON.parse(run(cli, ['render'], cwd, body)), expected)
  await verifyServer(cli, cwd, body, expected)
  console.log('Package qualification passed on Node.js ' + versions.node)
} finally {
  await rm(temp, { recursive: true, force: true, maxRetries: 3 })
}
