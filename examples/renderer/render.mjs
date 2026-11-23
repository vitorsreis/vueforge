/* global URL, console, process */

import { fileURLToPath } from 'node:url'

import { createVueforgeRenderer } from '../../dist/index.js'

const root = fileURLToPath(new URL('./', import.meta.url))
const renderer = await createVueforgeRenderer({
  root,
  mode:
    process.env.VUEFORGE_MODE === 'production' ? 'production' : 'development',
  main: 'src/App.vue',
  vite: { server: { hmr: false } },
})

try {
  const response = await renderer.render({
    context: {
      props: {
        title: process.argv[2] ?? 'Rendered by Vueforge',
      },
    },
    format: 'json',
  })

  console.log(JSON.stringify(response, null, 2))
} finally {
  await renderer.close()
}
