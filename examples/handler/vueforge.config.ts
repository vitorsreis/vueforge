import { createSSRApp, h } from 'vue'
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  main: (context) =>
    createSSRApp({
      render: () => h('h1', `Hello ${String(context.name ?? 'Vueforge')}`),
    }),
})
