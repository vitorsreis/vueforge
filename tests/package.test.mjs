import assert from 'node:assert/strict'
import test from 'node:test'

test('the package root exposes only the public helpers at runtime', async () => {
  const api = await import('@vitorsreis/vueforge')
  assert.deepEqual(Object.keys(api).sort(), [
    'createVueforgeApp',
    'defineConfig',
  ])
  assert.deepEqual(api.defineConfig({ server: { port: 4300 } }), {
    server: { port: 4300 },
  })
  const factory = (context, props) => ({ context, props })
  assert.equal(api.createVueforgeApp(factory), factory)
})

test('internal modules cannot be imported through package subpaths', async () => {
  await assert.rejects(import('@vitorsreis/vueforge/dist/config.js'), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  })
})
