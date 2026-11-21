import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import test from 'node:test'

import { developmentRenderer } from '../dist/server/development.js'

test('development compiles inline Vue templates with relative imports and CSS modules', async () => {
  const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'inline-sfc-'))
  try {
    await writeFile(
      join(root, 'Child.vue'),
      '<template><p>Child</p></template>',
    )
    const renderer = await developmentRenderer(
      root,
      {
        template: `<script setup>
import Child from './Child.vue'
defineProps(['context'])
</script>
<template><main :class="$style.root"><Child/>{{ context.title }}</main></template>
<style module>.root { color: red }</style>`,
        vite: { server: { ws: false } },
      },
      createServer(),
      '127.0.0.1',
      0,
    )
    try {
      const result = await renderer.render(
        { context: { title: 'Props' } },
        { title: 'Request' },
      )
      assert.match(result.content, /<p>Child<\/p>Request<\/main>/)
      const cssClass = /class="([^"]+)"/.exec(result.content)?.[1]
      assert.ok(cssClass)
      assert.match(
        result.assets.find(({ tag }) => tag === 'style')?.content ?? '',
        new RegExp(`\\.${cssClass}\\s*{`),
      )
    } finally {
      await renderer.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 3 })
  }
})

test('development collects initial CSS in browser order and includes rendered async styles', async () => {
  const scratch = fileURLToPath(new URL('../.vueforge/', import.meta.url))
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'dev-assets-'))
  const src = join(root, 'src')
  try {
    await mkdir(src)
    await Promise.all(
      Object.entries({
        'App.vue': `<script setup>
import { defineAsyncComponent } from 'vue'
import './site.css'
import Child from './Child.vue'
import inline from './unused.css?inline'
const Async = defineAsyncComponent(() => import('./Async.vue'))
const Unused = defineAsyncComponent(() => import('./Unused.vue'))
defineProps({ show: Boolean, unused: Boolean })
</script>
<template>
  <Teleport to="head"><meta name="test" content="teleported"></Teleport>
  <main :class="$style.root" :data-inline="inline"><Child/><Async v-if="show"/><Unused v-if="unused"/></main>
</template>
<style module>.root { color: maroon }</style>`,
        'Child.vue': `<template><p class="child">Child</p></template>
<style scoped>.child { color: green }</style>`,
        'Async.vue': `<template><p>Async</p></template>
<style>.async { color: orange }</style>`,
        'Unused.vue': `<template><p>Unused</p></template>
<style>.unused { color: blue }</style>`,
        'site.css': '.site { color: red }',
        'unused.css': '.unused-inline { color: yellow }',
      }).map(([file, content]) => writeFile(join(src, file), content)),
    )

    const server = createServer()
    const renderer = await developmentRenderer(
      root,
      { vite: { server: { ws: false } } },
      server,
      '127.0.0.1',
      0,
    )
    try {
      const [initial, async] = await Promise.all([
        renderer.render(),
        renderer.render({ show: true }),
      ])
      assert.match(
        initial.teleportHead,
        /<meta name="test" content="teleported">/,
      )
      assert.doesNotMatch(initial.content, /Async/)
      assert.match(async.content, /<p>Async<\/p>/)

      const styles = (result) =>
        result.assets.filter(({ tag }) => tag === 'style')
      assert.equal(styles(initial).length, 3)
      const [site, scoped, modules, lazy] = styles(async)
      assert.equal(styles(async).length, 4)
      assert.match(site.content, /\.site\s*{/)
      assert.match(scoped.content, /\.child\[data-v-\w+\]/)
      assert.match(
        modules.content,
        new RegExp(`\\.${/class="([^"]+)"/.exec(async.content)[1]}\\s*{`),
      )
      assert.match(lazy.content, /\.async\s*{/)
      assert.match(
        scoped.attrs['data-vite-dev-id'],
        /\/src\/Child\.vue\?vue&type=style&index=0&scoped=/,
      )
      assert.deepEqual(
        async.assets
          .filter(({ tag }) => tag === 'script')
          .map(({ attrs }) => attrs.src),
        ['/@vite/client', '/@vueforge/client'],
      )

      server.on('request', (req, res) => renderer.middleware(req, res))
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
      const origin = `http://127.0.0.1:${server.address().port}`
      const entry = await globalThis.fetch(`${origin}/@vueforge/client`)
      assert.equal(entry.status, 200)
      assert.match(await entry.text(), /vueforge-props/)
      const styleModule = await globalThis.fetch(
        `${origin}/src/Child.vue?${scoped.attrs['data-vite-dev-id'].split('?')[1]}`,
      )
      assert.equal(styleModule.status, 200)
      assert.ok(
        (await styleModule.text()).includes(
          JSON.stringify(scoped.attrs['data-vite-dev-id']),
        ),
      )
    } finally {
      if (server.listening)
        await new Promise((resolve) => server.close(resolve))
      await renderer.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 3 })
  }
})
