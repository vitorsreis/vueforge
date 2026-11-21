import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { execPath } from 'node:process'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath, URL } from 'node:url'

const { fetch, AbortSignal } = globalThis
const cli = fileURLToPath(new URL('../bin/vueforge', import.meta.url))
const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))

async function project(t, config, files = {}) {
  await mkdir(scratch, { recursive: true })
  const cwd = await mkdtemp(join(scratch, 'configured-render-'))
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }))
  await mkdir(join(cwd, 'src'))
  await Promise.all(
    Object.entries({
      'vueforge.config.ts': 'export default ' + JSON.stringify(config),
      'src/App.vue': '<template><p>Default app</p></template>',
      ...files,
    }).map(([file, content]) => writeFile(join(cwd, file), content)),
  )
  return cwd
}

function run(cwd, command, request) {
  const result = spawnSync(execPath, [cli, command], {
    cwd,
    input: JSON.stringify(request),
    encoding: 'utf8',
    timeout: 30000,
  })
  assert.ifError(result.error)
  return result
}

async function serve(cwd, verify) {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  await new Promise((resolve) => socket.close(resolve))

  const origin = 'http://127.0.0.1:' + port
  const child = spawn(
    execPath,
    [cli, 'serve', '--dev', '--port', String(port)],
    {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const closed = once(child, 'close')
  let log = ''
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8').on('data', (chunk) => {
      log += chunk
    })
  }

  try {
    const deadline = Date.now() + 15000
    while (!log.includes(origin)) {
      assert.ok(
        child.exitCode === null && Date.now() < deadline,
        'Startup failed: ' + log,
      )
      await delay(50)
    }

    await verify((request) =>
      fetch(origin + '/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(5000),
      }),
    )
  } finally {
    child.kill()
    await closed
  }
}

const template = [
  '<script setup>',
  "import LocalChild from './LocalChild.vue'",
  'defineProps({ title: String, context: Object })',
  '</script>',
  '<template><main class="inline"><LocalChild/>{{ title }} {{ context?.label }}</main></template>',
  '<style scoped>.inline { color: teal }</style>',
].join('\n')

const entry = [
  "import { createSSRApp, h } from 'vue'",
  'export default async (context, props) => {',
  '  await new Promise((resolve) => setTimeout(resolve, context?.delay ?? 0))',
  "  return createSSRApp({ render: () => h('h1', (props?.title ?? 'Untitled') + ' ' + (context?.label ?? 'anonymous')) })",
  '}',
].join('\n')

for (const { name, config, files, content } of [
  {
    name: 'file',
    config: { file: './src/Chosen.vue' },
    files: {
      'src/Chosen.vue': [
        '<script setup>defineProps({ title: String, context: Object })</script>',
        '<template><h1>{{ title }} {{ context?.label }}</h1></template>',
      ].join('\n'),
    },
    content: /^<h1>Hello Ada<\/h1>$/,
  },
  {
    name: 'template',
    config: { template },
    files: { 'LocalChild.vue': '<template><span>Welcome</span></template>' },
    content:
      /^<main class="inline" data-v-\w+><span(?: data-v-\w+)?>Welcome<\/span>Hello Ada<\/main>$/,
  },
  {
    name: 'entry',
    config: { entry: './src/custom-entry.ts' },
    files: { 'src/custom-entry.ts': entry },
    content: /^<h1>Hello Ada<\/h1>$/,
  },
]) {
  test(
    'renders configured ' +
      name +
      ' in development and from a production build',
    { timeout: 60000 },
    async (t) => {
      const cwd = await project(t, config, files)
      const request = {
        props: { title: 'Hello', context: { label: 'Shadowed' } },
        context: { label: 'Ada' },
        format: 'json',
      }

      await serve(cwd, async (post) => {
        const response = await post(request)
        assert.equal(response.status, 200, await response.clone().text())
        const result = await response.json()
        assert.match(result.content, content)
        assert.ok(
          result.head.every(({ attrs }) => attrs?.id !== 'vueforge-context'),
        )
        if (name === 'template') {
          const style = result.head.find(({ tag }) => tag === 'style')
          assert.match(
            style?.content,
            /\.inline\[data-v-\w+\]\s*\{\s*color:\s*teal/,
          )
        }
      })

      const build = run(cwd, 'build')
      assert.equal(build.status, 0, build.stderr)
      const stdio = run(cwd, 'render', request)
      assert.equal(stdio.status, 0, stdio.stderr)
      const result = JSON.parse(stdio.stdout)
      assert.match(result.content, content)
      if (name === 'template') {
        const css = result.head.find(({ attrs }) => attrs?.rel === 'stylesheet')
        assert.ok(css)
        assert.match(
          await readFile(join(cwd, '.vueforge/client', css.attrs.href), 'utf8'),
          /\.inline\[data-v-\w+\]\s*\{\s*color:\s*teal/,
        )
      }
    },
  )
}

test('validates configured render sources before building', async (t) => {
  const cwd = await project(t, {})
  for (const [config, expected] of [
    [{ file: './src/App.vue', template }, /file.*template|template.*file/i],
    [{ file: ' ' }, /\bfile\b/i],
    [{ template: false }, /\btemplate\b/i],
    [{ entry: [] }, /\bentry\b/i],
  ]) {
    await writeFile(
      join(cwd, 'vueforge.config.ts'),
      'export default ' + JSON.stringify(config),
    )
    const result = run(cwd, 'build')
    assert.equal(result.status, 1, JSON.stringify(config))
    assert.match(result.stderr, expected)
  }
})

test(
  'isolates each context and serializes it only for hydration',
  { timeout: 60000 },
  async (t) => {
    const cwd = await project(
      t,
      { entry: './src/custom-entry.ts' },
      { 'src/custom-entry.ts': entry },
    )
    await serve(cwd, async (post) => {
      const invalid = await post({ context: [] })
      assert.equal(invalid.status, 400)
      assert.match((await invalid.json()).error, /context.*JSON object/)

      const [first, second, noContext] = await Promise.all([
        post({ context: { label: 'Ada', delay: 80 } }),
        post({ context: { label: 'Lin' } }),
        post({}),
      ])
      for (const [response, label] of [
        [first, 'Ada'],
        [second, 'Lin'],
        [noContext, 'anonymous'],
      ]) {
        assert.equal(response.status, 200, await response.clone().text())
        assert.deepEqual(await response.json(), {
          head: '',
          content: '<h1>Untitled ' + label + '</h1>',
        })
      }

      const context = { label: 'Ada', text: 'A < B & C > D' }
      const response = await post({ context, hydrate: true, format: 'json' })
      assert.equal(response.status, 200, await response.clone().text())
      const { head } = await response.json()
      const index = head.findIndex(
        ({ attrs }) => attrs?.id === 'vueforge-context',
      )
      assert.ok(index >= 0)
      const data = head[index]
      assert.equal(data.tag, 'script')
      assert.equal(data.attrs.type, 'application/json')
      assert.doesNotMatch(data.content, /</)
      assert.deepEqual(JSON.parse(data.content), context)
      assert.ok(
        index <
          head.findIndex(({ attrs }) => attrs?.src === '/@vueforge/client'),
      )
    })
  },
)
