import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execPath } from 'node:process'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

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
  ]) {
    const result = run(projectRoot, args)
    assert.equal(result.status, 2)
    assert.match(result.stderr, /^Error:/)
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
    "export default { tempDir: 'cache/vueforge' }",
  )

  const build = run(cwd, ['build', '--config', 'config/vueforge.local.ts'])
  assert.equal(build.status, 0, build.stderr)
  await access(join(cwd, 'cache/vueforge/server/entry.mjs'))

  const html = run(
    cwd,
    ['render', '--config', 'config/vueforge.local.ts', '--format', 'html'],
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
