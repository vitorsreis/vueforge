import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import { buildProject } from '../dist/build.js'
import { loadProjectConfig, resolveTempDir } from '../dist/config.js'
import { createVueforgeRenderer } from '../dist/index.js'

const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

async function createProject(t, config, files) {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'renderer-api-'))
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }))
  const projectFiles = {
    ...(config === undefined
      ? {}
      : { 'vueforge.config.ts': `export default ${config}` }),
    ...files,
  }
  for (const [name, content] of Object.entries(projectFiles)) {
    const file = join(root, name)
    await mkdir(join(file, '..'), { recursive: true })
    await writeFile(file, content)
  }
  return root
}

test('public renderer renders development requests without an HTTP framework', async (t) => {
  const root = await createProject(
    t,
    `{ main: 'src/App.vue', vite: { server: { hmr: false } } }`,
    {
      'src/App.vue':
        '<script setup>defineProps({ title: String })</script><template><h1>{{ title }}</h1></template>',
    },
  )

  const renderer = await createVueforgeRenderer({ root, mode: 'development' })
  t.after(() => renderer.close())

  const response = await renderer.render({
    context: { props: { title: 'Development' } },
    format: 'json',
  })
  assert.equal(renderer.mode, 'development')
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    head: [
      { tag: 'script', attrs: { type: 'module', src: '/@vite/client' } },
      { tag: 'script', attrs: { type: 'module', src: '/@vueforge/client' } },
    ],
    content: '<h1>Development</h1>',
  })
})

test('public renderer accepts config-shaped options and ignores the project config file', async (t) => {
  const root = await createProject(t, undefined, {
    'vueforge.config.ts': "export default { main: 'src/Missing.vue' }",
    'src/App.vue': '<template><h1>Inline config</h1></template>',
  })

  const renderer = await createVueforgeRenderer({
    root,
    mode: 'development',
    main: 'src/App.vue',
    vite: { server: { hmr: false } },
  })
  t.after(() => renderer.close())

  const response = await renderer.render({ context: {}, format: 'json' })
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    head: [
      { tag: 'script', attrs: { type: 'module', src: '/@vite/client' } },
      { tag: 'script', attrs: { type: 'module', src: '/@vueforge/client' } },
    ],
    content: '<h1>Inline config</h1>',
  })
})

test('public renderer accepts a custom config path', async (t) => {
  const root = await createProject(t, undefined, {
    'custom/vueforge.server.ts':
      "export default { mode: 'development', main: 'src/App.vue' }",
    'src/App.vue': '<template><h1>Custom config</h1></template>',
  })

  const renderer = await createVueforgeRenderer({
    root,
    config: 'custom/vueforge.server.ts',
  })
  t.after(() => renderer.close())

  const response = await renderer.render({ context: {}, format: 'json' })
  assert.equal(renderer.mode, 'development')
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    head: [
      { tag: 'script', attrs: { type: 'module', src: '/@vite/client' } },
      { tag: 'script', attrs: { type: 'module', src: '/@vueforge/client' } },
    ],
    content: '<h1>Custom config</h1>',
  })
})

test('public renderer loads production artifacts and closes idempotently', async (t) => {
  const root = await createProject(
    t,
    `{ main: 'src/App.vue', build: { outDir: 'artifacts' } }`,
    {
      'src/App.vue':
        '<script setup>defineProps({ title: String })</script><template><h1>{{ title }}</h1></template>',
    },
  )
  const config = await loadProjectConfig(root, {
    command: 'build',
    mode: 'production',
  })
  await buildProject(root, resolveTempDir(root, config.tempDir), config)

  const renderer = await createVueforgeRenderer({ root })
  const response = await renderer.render({
    context: { props: { title: 'Production' } },
    format: 'json',
  })
  assert.equal(renderer.mode, 'production')
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    head: [],
    content: '<h1>Production</h1>',
  })

  await renderer.close()
  await renderer.close()
  await assert.rejects(
    renderer.render({ context: {}, format: 'json' }),
    /already closed/i,
  )
})

test('public renderer rejects unknown catalog templates without exposing names', async (t) => {
  const root = await createProject(
    t,
    `{ main: 'src/pages', build: { outDir: 'artifacts' } }`,
    {
      'src/pages/home.vue': '<template><h1>Home</h1></template>',
    },
  )
  const config = await loadProjectConfig(root, {
    command: 'build',
    mode: 'production',
  })
  await buildProject(root, resolveTempDir(root, config.tempDir), config)

  const renderer = await createVueforgeRenderer({ root })
  t.after(() => renderer.close())
  const response = await renderer.render({
    context: {},
    template: 'missing',
  })

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, {
    error: 'Unknown template "missing".',
  })
})
