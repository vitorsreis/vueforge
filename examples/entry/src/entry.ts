import { createSSRApp } from 'vue'
import { createVueforgeApp } from '@vitorsreis/vueforge'
import App from './App.vue'

export default createVueforgeApp<{ props?: { name?: string } }>((context) => {
  return createSSRApp(App, context.props)
})
