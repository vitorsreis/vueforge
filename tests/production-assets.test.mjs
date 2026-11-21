import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import express from 'express'

import { buildProject } from '../dist/build.js'
import { productionRenderer } from '../dist/server/production.js'

const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

test('production records the files from the current build and serves copied public assets', async (t) => {
  await mkdir(scratch, { recursive: true })
  const directory = await mkdtemp(join(scratch, 'production-assets-'))
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }))

  const root = join(directory, 'project')
  const tempDir = join(directory, 'artifacts')
  const publicDir = join(root, 'public', 'help page')
  await mkdir(publicDir, { recursive: true })
  await writeFile(join(publicDir, 'index.html'), '<p>Help</p>')
  await writeFile(join(publicDir, 'previous.txt'), 'Previous document')
  await writeFile(
    join(root, 'Details.vue'),
    '<template><p>Details</p></template>',
  )

  const config = {
    template: `<script setup>
import { defineAsyncComponent } from 'vue'
const Details = defineAsyncComponent(() => import('./Details.vue'))
</script>
<template><main><Details /></main></template>`,
    vite: {},
  }
  await buildProject(root, tempDir, config)
  await rm(join(publicDir, 'previous.txt'))
  await buildProject(root, tempDir, config)

  const clientDir = join(tempDir, 'client')
  assert.equal(
    await readFile(join(clientDir, 'help page/previous.txt'), 'utf8'),
    'Previous document',
  )
  const files = JSON.parse(
    await readFile(join(clientDir, '.vite/vueforge-assets.json'), 'utf8'),
  )
  assert.ok(files.includes('help page/index.html'))
  assert.ok(!files.includes('help page/previous.txt'))

  const app = express()
  app.use((await productionRenderer(tempDir)).middleware)
  const server = app.listen(0, '127.0.0.1')
  t.after(() => server.close())
  await once(server, 'listening')

  const url = `http://127.0.0.1:${server.address().port}`
  const response = await globalThis.fetch(url + '/help%20page?locale=en')
  assert.equal(response.status, 200)
  assert.equal(response.url, url + '/help%20page/?locale=en')
  assert.equal(await response.text(), '<p>Help</p>')

  const manifest = JSON.parse(
    await readFile(join(clientDir, '.vite/manifest.json'), 'utf8'),
  )
  const details = Object.values(manifest).find((entry) => entry.isDynamicEntry)
  assert.ok(details)
  const chunk = await globalThis.fetch(url + '/' + details.file)
  assert.equal(chunk.status, 200)
  assert.match(await chunk.text(), /Details/)

  const previous = await globalThis.fetch(url + '/help%20page/previous.txt')
  assert.equal(previous.status, 404)
  await previous.body.cancel()
})
