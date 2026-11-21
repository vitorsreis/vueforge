import { createSSRApp } from 'vue'
import { createVueforgeApp } from '@vitorsreis/vueforge'
import App from './App.vue'

export default createVueforgeApp((context, props) => {
  return createSSRApp(App, {
    ...props,
    name: context?.name,
  })
})
