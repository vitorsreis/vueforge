import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import {
  loadProjectConfig,
  resolveAppSource,
  resolveAppSources,
  resolveAssetBase,
  resolveBuildOutputDir,
  resolveRenderLimits,
} from '../dist/config.js'

const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

test('resolves template paths as components when they target SFC files', async (t) => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'config-contract-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'src/App.vue'), '<template><p>App</p></template>')

  assert.deepEqual(await resolveAppSource(root, { template: 'src/App.vue' }), {
    kind: 'component',
    url: '/src/App.vue',
  })
})

test('loads an imported Vue component from vueforge.config.ts', async (t) => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'config-import-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'src'))
  await writeFile(
    join(root, 'src/Home.vue'),
    '<template><h1>Home</h1></template>',
  )
  await writeFile(
    join(root, 'vueforge.config.ts'),
    "import Home from './src/Home.vue'\nexport default { template: Home }",
  )

  const config = await loadProjectConfig(root, {
    command: 'build',
    mode: 'production',
  })
  assert.deepEqual(await resolveAppSource(root, config), {
    kind: 'component',
    url: '/src/Home.vue',
  })
})

test('resolves named catalogs from paths, inline SFCs, and imported components', async (t) => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'config-catalog-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'src'))
  await writeFile(
    join(root, 'src/Home.vue'),
    '<template><h1>Home</h1></template>',
  )
  await writeFile(
    join(root, 'vueforge.config.ts'),
    [
      "import Home from './src/Home.vue'",
      'export default { templates: {',
      "  path: 'src/Home.vue',",
      '  component: Home,',
      "  inline: '<template><p>Inline</p></template>',",
      '} }',
    ].join('\n'),
  )

  const config = await loadProjectConfig(root, {
    command: 'build',
    mode: 'production',
  })
  const sources = await resolveAppSources(root, config)
  assert.deepEqual(sources.templates, {
    path: { kind: 'component', url: '/src/Home.vue' },
    component: { kind: 'component', url: '/src/Home.vue' },
    inline: { kind: 'template', code: '<template><p>Inline</p></template>' },
  })
})

test('rejects template names that target object prototypes', async (t) => {
  const root = await mkdtemp(join(scratch, 'config-catalog-name-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await assert.rejects(
    resolveAppSources(root, {
      templates: {
        ['__proto__']: '<template><p>Unsafe</p></template>',
      },
    }),
    /safe identifiers/i,
  )
})

test('resolves build output and validates configured render limits', () => {
  const config = {
    limits: {
      maxRequestBytes: 1000,
      maxConcurrentRenders: 3,
      renderTimeoutMs: 1500,
      maxOutputBytes: 5000,
    },
  }

  assert.equal(
    resolveBuildOutputDir('C:/project', 'dist/app'),
    'C:\\project\\dist\\app',
  )
  assert.deepEqual(resolveRenderLimits(config), config.limits)
  assert.throws(
    () => resolveRenderLimits({ limits: { renderTimeoutMs: 0 } }),
    /positive safe integer/,
  )
})

test('rejects unsupported source file extensions', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'Vueforge-source-extension-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'src.txt'), 'not an app')

  await assert.rejects(
    resolveAppSource(root, { template: 'src.txt' }),
    /template must point to a \.vue/i,
  )
})

test('resolves origin and base for public browser assets', () => {
  assert.equal(resolveAssetBase(undefined, '/admin'), '/admin/')
  assert.equal(
    resolveAssetBase('http://127.0.0.1:9901', '/admin'),
    'http://127.0.0.1:9901/admin/',
  )
  assert.throws(() => resolveAssetBase('localhost:9901', '/admin'), /origin/)
})
