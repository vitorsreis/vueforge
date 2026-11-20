import assert from 'node:assert/strict'
import test from 'node:test'

test('the package root exposes only the configuration helper at runtime', async () => {
  const api = await import('vueforge')
  assert.deepEqual(Object.keys(api), ['defineConfig'])
  assert.deepEqual(api.defineConfig({ port: 4300 }), { port: 4300 })
})

test('internal modules cannot be imported through package subpaths', async () => {
  await assert.rejects(import('vueforge/dist/config.js'), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  })
})
