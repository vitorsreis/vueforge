import { createSSRApp } from 'vue'

import App from './App.vue'

export function createApp(context?: { title: string; initialCount: number }) {
  const app = createSSRApp(App, {
    title: context?.title,
    initialCount: context?.initialCount,
  })
  return { app }
}
