import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join, resolve as resolvePath } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import {
  loadProjectConfig,
  resolveAppSource,
  resolveAppSources,
  resolveAssetBase,
  resolveBuildOutputDir,
  resolveMode,
  resolveRenderLimits,
} from '../dist/config.js'

const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

async function createRoot(t, files = {}) {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'config-contract-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(root, name, '..'), { recursive: true })
    await writeFile(join(root, name), content)
  }
  return root
}

test('resolves a Vue file configured as main', async (t) => {
  const root = await createRoot(t, {
    'src/App.vue': '<template><p>App</p></template>',
  })

  assert.deepEqual(await resolveAppSource(root, { main: 'src/App.vue' }), {
    kind: 'component',
    url: '/src/App.vue',
  })
})

test('loads an imported Vue component from vueforge.config.ts', async (t) => {
  const root = await createRoot(t, {
    'src/Home.vue': '<template><h1>Home</h1></template>',
    'vueforge.config.ts':
      "import Home from './src/Home.vue'\nexport default { main: Home }",
  })

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
  const root = await createRoot(t, {
    'src/Home.vue': '<template><h1>Home</h1></template>',
    'vueforge.config.ts': [
      "import Home from './src/Home.vue'",
      'export default { main: {',
      "  path: 'src/Home.vue',",
      '  component: Home,',
      "  inline: '<template><p>Inline</p></template>',",
      '} }',
    ].join('\n'),
  })

  const config = await loadProjectConfig(root, {
    command: 'build',
    mode: 'production',
  })
  const sources = await resolveAppSources(root, config)
  assert.equal(sources.kind, 'templates')
  assert.deepEqual(sources.templates, {
    path: { kind: 'component', url: '/src/Home.vue' },
    component: { kind: 'component', url: '/src/Home.vue' },
    inline: { kind: 'template', code: '<template><p>Inline</p></template>' },
  })
})

test('resolves pattern catalogs', async (t) => {
  const root = await createRoot(t, {
    'src/pages/home.page.vue': '<template><p>Home</p></template>',
    'src/pages/invoice.page.vue': '<template><p>Invoice</p></template>',
    'src/pages/ignored.vue': '<template><p>Ignored</p></template>',
  })

  const pattern = await resolveAppSources(root, { main: /\.page\.vue$/ })
  assert.equal(pattern.kind, 'templates')
  assert.deepEqual(Object.keys(pattern.templates), [
    'pages/home.page',
    'pages/invoice.page',
  ])
})

test('rejects template names that target object prototypes', async (t) => {
  const root = await createRoot(t, {
    'src/App.vue': '<template><p>App</p></template>',
  })
  await assert.rejects(
    resolveAppSources(root, {
      main: { ['__proto__']: '<template><p>Unsafe</p></template>' },
    }),
    /safe identifiers/i,
  )
})

test('resolves build output and validates configured render limits', () => {
  const projectRoot = resolvePath('project')
  const config = {
    limits: {
      maxRequestBytes: 1000,
      maxConcurrentRenders: 3,
      renderTimeoutMs: 1500,
      maxOutputBytes: 5000,
    },
  }

  assert.equal(
    resolveBuildOutputDir(projectRoot, 'dist/app'),
    join(projectRoot, 'dist', 'app'),
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
    resolveAppSource(root, { main: 'src.txt' }),
    /main must point to a \.ts/i,
  )
})

test('resolves origin and base for public browser assets', () => {
  assert.equal(resolveAssetBase(undefined, '/admin'), '/admin/')
  assert.equal(
    resolveAssetBase('http://127.0.0.1:9901', '/admin'),
    'http://127.0.0.1:9901/admin/',
  )
  assert.throws(() => resolveAssetBase('localhost:9901', '/admin'), /origin/)
  assert.throws(() =>
    resolveAssetBase('https://example.com', '//attacker.test'),
  )
  assert.throws(() => resolveAssetBase(undefined, '/admin?next=/'))
})

test('resolves and validates runtime modes', () => {
  assert.equal(resolveMode(undefined), 'production')
  assert.equal(resolveMode('development'), 'development')
  assert.throws(
    () => resolveMode('preview'),
    /mode must be "development" or "production"/i,
  )
})

test('passes configured runtime mode to vite.config.ts', async (t) => {
  const root = await createRoot(t, {
    'vueforge.config.ts': "export default { mode: 'development' }",
    'vite.config.ts': [
      "import { defineConfig } from 'vite'",
      'export default defineConfig(({ mode }) => ({',
      '  define: { __VUEFORGE_CONFIG_MODE__: JSON.stringify(mode) },',
      '}))',
    ].join('\n'),
  })

  const config = await loadProjectConfig(root, {
    command: 'serve',
    mode: 'production',
  })
  assert.equal(config.vite?.define?.__VUEFORGE_CONFIG_MODE__, '"development"')
})

test('loads vite.config.ts from the configured project root', async (t) => {
  const root = await createRoot(t, {
    'vueforge.config.ts': "export default { root: 'app' }",
    'app/vite.config.ts': [
      "import { defineConfig } from 'vite'",
      'export default defineConfig({ define: { __VUEFORGE_ROOT_CONFIG__: JSON.stringify(true) } })',
    ].join('\n'),
  })

  const config = await loadProjectConfig(root, {
    command: 'serve',
    mode: 'production',
  })
  assert.equal(config.root, join(root, 'app'))
  assert.equal(config.vite?.define?.__VUEFORGE_ROOT_CONFIG__, 'true')
})

test('explicit mode override wins over the project mode for vite.config.ts', async (t) => {
  const root = await createRoot(t, {
    'vueforge.config.ts': "export default { mode: 'production' }",
    'vite.config.ts': [
      "import { defineConfig } from 'vite'",
      'export default defineConfig(({ mode }) => ({ define: { __VUEFORGE_CONFIG_MODE__: JSON.stringify(mode) } }))',
    ].join('\n'),
  })

  const config = await loadProjectConfig(
    root,
    { command: 'serve', mode: 'production' },
    undefined,
    undefined,
    undefined,
    'development',
  )
  assert.equal(config.vite?.define?.__VUEFORGE_CONFIG_MODE__, '"development"')
})
