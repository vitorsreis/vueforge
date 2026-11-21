import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execPath } from 'node:process'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import express from 'express'

import { productionRenderer } from '../dist/server/production/renderer.js'
import { renderRoute } from '../dist/server/render/route.js'

const { fetch, AbortSignal } = globalThis
const cli = fileURLToPath(new URL('../bin/vueforge', import.meta.url))
const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

function run(cwd, command, input) {
  const result = spawnSync(execPath, [cli, command], {
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
  const cwd = await mkdtemp(join(scratch, 'stdio-test-'))
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }))
  return cwd
}

test('render uses compiled SSR and writes only the response to stdout', async (t) => {
  const cwd = await project(t)
  await mkdir(join(cwd, 'src'))
  await writeFile(
    join(cwd, 'src/App.vue'),
    `<script setup>
const { title = 'Default' } = defineProps({ title: String })
console.log('component diagnostic')
if (title === 'Throw') throw new Error('component failure')
</script>
<template><h1>{{ title }}</h1></template>`,
  )
  await writeFile(
    join(cwd, 'vueforge.config.ts'),
    `console.log('config diagnostic')
export default { tempDir: 'cache/temp', build: { outDir: 'cache/render output' }, server: { port: 0 } }`,
  )
  const build = run(cwd, 'build')
  assert.equal(build.status, 0, build.stderr)
  await rm(join(cwd, 'src/App.vue'))

  const input = '{"props":{"title":"Ol\u00e1 & <Vue>"}}'
  const atLimit = input + ' '.repeat(65536 - Buffer.byteLength(input))
  const result = run(cwd, 'render', atLimit)
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {
    head: [],
    content: '<h1>Ol\u00e1 &amp; &lt;Vue&gt;</h1>',
  })
  assert.match(result.stderr, /config diagnostic/)
  assert.match(result.stderr, /component diagnostic/)

  const { render } = await productionRenderer(join(cwd, 'cache/render output'))
  const http = express()
    .use('/render', renderRoute(render))
    .listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve) => http.close(resolve)))
  await once(http, 'listening')

  for (const body of [atLimit, '{"props":{"title":"Hello <Vue>"}}']) {
    const stdio = run(cwd, 'render', body)
    assert.equal(stdio.status, 0, stdio.stderr)
    const response = await fetch(
      `http://127.0.0.1:${http.address().port}/render`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(5000),
      },
    )
    assert.equal(response.status, 200)
    assert.equal(stdio.stdout, (await response.text()) + '\n')
  }

  const failed = run(cwd, 'render', '{"props":{"title":"Throw"}}')
  assert.equal(failed.status, 1, failed.stderr)
  assert.equal(failed.stdout, '')
  assert.match(failed.stderr, /component failure/)
})

test('render rejects malformed, non-UTF-8 and oversized stdin without stdout', async (t) => {
  const cwd = await project(t)
  for (const [input, error] of [
    ['{}\n{}', /valid JSON context object/],
    ['null', /request body.*object/i],
    [Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x30, 0x7d]), /UTF-8/],
    ['{"\u00e1":0}'.padEnd(65536), /64 KiB/],
    ['{}', /vueforge build/],
  ]) {
    const result = run(cwd, 'render', input)
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, error)
  }
})
