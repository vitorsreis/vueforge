import { createSSRApp } from 'vue'

import App from './App.vue'

export function createApp(
  context?: { title: string; initialCount: number },
  runtime?: { target: string; mode: string },
) {
  const app = createSSRApp(App, {
    title: context?.title,
    initialCount: context?.initialCount,
  })
  app.provide(
    'vueforgeRuntimeTarget',
    runtime && `${runtime.target}:${runtime.mode}`,
  )
  return { app }
}
