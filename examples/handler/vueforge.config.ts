import { createSSRApp, h } from 'vue'
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  main({ name }) {
    return createSSRApp({
      render: () => h('h1', `Hello ${String(name ?? 'Vueforge')}`),
    })
  },
})
