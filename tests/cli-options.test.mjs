import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execPath } from 'node:process'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import { parseCliArguments } from '../dist/cli/arguments.js'

const cli = fileURLToPath(new URL('../bin/vueforge', import.meta.url))
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const scratch = join(projectRoot, '.vueforge')

function run(cwd, args, input) {
  const result = spawnSync(execPath, [cli, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout: 30000,
  })
  assert.ifError(result.error)
  return result
}

async function project(t) {
  await mkdir(scratch, { recursive: true })
  const cwd = await mkdtemp(join(scratch, 'cli-options-'))
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }))
  return cwd
}

test('prints global and command-specific help and the package version', () => {
  for (const [args, expected] of [
    [['--help'], 'Usage: vueforge <command> [options]'],
    [['-h'], 'Usage: vueforge <command> [options]'],
    [['serve', '--help'], 'Usage: vueforge serve [options]'],
    [['build', '--help'], 'Usage: vueforge build [options]'],
    [['render', '--help'], 'Usage: vueforge render [options]'],
  ]) {
    const result = run(projectRoot, args)
    assert.equal(result.status, 0, result.stderr)
    assert.match(
      result.stdout,
      new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
  }

  const packageVersion = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  )
  for (const args of [['--version'], ['-v']]) {
    const result = run(projectRoot, args)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), packageVersion.version)
  }
})

test('rejects options used with the wrong command', () => {
  for (const args of [
    ['build', '--dev'],
    ['serve', '--format', 'json'],
    ['render', '--port', '9901'],
    ['render', '--max-concurrent-renders', '2'],
    ['build', '--max-request-bytes', '64'],
  ]) {
    const result = run(projectRoot, args)
    assert.equal(result.status, 2)
    assert.match(result.stderr, /^Error:/)
  }
})

test('parses transport and render overrides', () => {
  const serve = parseCliArguments([
    '-r',
    'project',
    'serve',
    '-c',
    'project.ts',
    '--unix',
    'server.sock',
    '--ssl-cert',
    'cert.pem',
    '--ssl-key',
    'key.pem',
    '--ssl-ca',
    'ca.pem',
    '--shutdown-timeout-ms',
    '3000',
    '--max-request-bytes',
    '128',
    '--max-output-bytes',
    '256',
    '--render-timeout-ms',
    '500',
    '--max-concurrent-renders',
    '2',
  ])
  assert.equal(serve.root, 'project')
  assert.equal(serve.config, 'project.ts')
  assert.equal(serve.unix, 'server.sock')
  assert.equal(serve.shutdownTimeoutMs, 3000)
  assert.deepEqual(serve.ssl, {
    cert: 'cert.pem',
    key: 'key.pem',
    ca: 'ca.pem',
  })
  assert.deepEqual(serve.limits, {
    maxRequestBytes: 128,
    maxOutputBytes: 256,
    renderTimeoutMs: 500,
    maxConcurrentRenders: 2,
  })
  assert.equal(parseCliArguments(['serve', '--stdio']).stdio, true)

  const render = parseCliArguments([
    'render',
    '-f',
    'html',
    '--max-request-bytes',
    '128',
  ])
  assert.equal(render.format, 'html')
  assert.deepEqual(render.limits, { maxRequestBytes: 128 })
})

test('rejects conflicting transport flags and invalid limits', () => {
  for (const [args, expected] of [
    [['--stdio', '--dev'], /--stdio.*--dev/],
    [['--stdio', '--unix', 'server.sock'], /--stdio.*--unix/],
    [['--stdio', '--host', 'localhost'], /--stdio.*--host/],
    [['--unix', 'server.sock', '--port', '9901'], /--unix.*--port/],
    [['--stdio', '--ssl-cert', 'cert.pem'], /--stdio.*TLS/],
    [['--shutdown-timeout-ms', '0'], /positive integer/],
    [['--max-output-bytes', '1.5'], /positive integer/],
    [['--max-concurrent-renders', '9007199254740992'], /positive integer/],
    [['-p', '9901'], /Unknown option/],
  ]) {
    assert.throws(() => parseCliArguments(['serve', ...args]), expected)
  }
})

test('loads a custom configuration file and supports explicit render formats', async (t) => {
  const cwd = await project(t)
  await mkdir(join(cwd, 'src'), { recursive: true })
  await mkdir(join(cwd, 'config'))
  await writeFile(
    join(cwd, 'src/App.vue'),
    '<template><h1>{{ title }}</h1></template>\n<script setup>defineProps({ title: String })</script>',
  )
  await writeFile(
    join(cwd, 'config/vueforge.local.ts'),
    "export default { tempDir: 'cache/tmp', build: { outDir: 'cache/vueforge' } }",
  )

  const build = run(cwd, ['build', '--config', 'config/vueforge.local.ts'])
  assert.equal(build.status, 0, build.stderr)
  await access(join(cwd, 'cache/vueforge/client/.vite/manifest.json'))
  await access(join(cwd, 'cache/vueforge/server/entry.mjs'))

  const html = run(
    cwd,
    ['render', '--config', 'config/vueforge.local.ts', '-f', 'html'],
    '{"props":{"title":"Hello"}}',
  )
  assert.equal(html.status, 0, html.stderr)
  assert.match(html.stdout, /^<!doctype html>/)
  assert.match(html.stdout, /<div id="app"><h1>Hello<\/h1><\/div>/)

  const json = run(
    cwd,
    ['render', '--config', 'config/vueforge.local.ts', '--format', 'json'],
    '{"format":"html","props":{"title":"JSON"}}',
  )
  assert.equal(json.status, 0, json.stderr)
  assert.deepEqual(JSON.parse(json.stdout), {
    head: [],
    content: '<h1>JSON</h1>',
  })

  const pretty = run(
    cwd,
    ['render', '--config', 'config/vueforge.local.ts', '--pretty'],
    '{"props":{"title":"Pretty"}}',
  )
  assert.equal(pretty.status, 0, pretty.stderr)
  assert.match(pretty.stdout, new RegExp('\\n {2}"content": "<h1>Pretty</h1>"'))
})

test('reports invalid custom configuration paths clearly', async (t) => {
  const cwd = await project(t)
  const missing = run(cwd, ['build', '--config', 'missing.ts'])
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /configuration file does not exist/i)

  const unsupported = run(cwd, ['build', '--config', 'config.json'])
  assert.equal(unsupported.status, 1)
  assert.match(
    unsupported.stderr,
    /must use .js, .mjs, .cjs, .ts, .mts, or .cts/i,
  )
})

test('resolves build and render paths from a configured project root', async (t) => {
  const cwd = await project(t)
  const appRoot = join(cwd, 'app')
  await mkdir(join(appRoot, 'src'), { recursive: true })
  await writeFile(
    join(cwd, 'vueforge.config.ts'),
    "export default { root: 'app', tempDir: '.cache', build: { outDir: 'artifacts' } }",
  )
  await writeFile(
    join(appRoot, 'src/App.vue'),
    '<template><h1>{{ title }}</h1></template>\n<script setup>defineProps({ title: String })</script>',
  )

  const build = run(cwd, ['build'])
  assert.equal(build.status, 0, build.stderr)
  await access(join(appRoot, 'artifacts/client/.vite/manifest.json'))
  await access(join(appRoot, 'artifacts/server/entry.mjs'))

  const render = run(cwd, ['render'], '{"props":{"title":"Nested"}}')
  assert.equal(render.status, 0, render.stderr)
  assert.equal(JSON.parse(render.stdout).content, '<h1>Nested</h1>')
})
