import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp(context, props) {
  return createSSRApp(App, {
    ...props,
    name: context?.name,
  })
}
