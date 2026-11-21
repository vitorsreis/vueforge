import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import {
  loadProjectConfig,
  resolveAppSource,
  resolveBuildOutputDir,
  resolveRenderLimits,
} from '../dist/config.js'

const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

test('resolves source paths as components when they target SFC files', async (t) => {
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'config-contract-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'src'))
  await writeFile(join(root, 'src/App.vue'), '<template><p>App</p></template>')

  assert.deepEqual(await resolveAppSource(root, { source: 'src/App.vue' }), {
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
    "import Home from './src/Home.vue'\nexport default { source: Home }",
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
