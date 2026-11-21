import { createSSRApp } from 'vue'
import { defineApp } from 'vueforge'

import App from './App.vue'

export default defineApp((context) =>
  createSSRApp(App, {
    title: context?.title,
    initialCount: context?.initialCount,
  }),
)
