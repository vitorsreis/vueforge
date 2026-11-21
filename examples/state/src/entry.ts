import { createSSRApp } from 'vue'
import { createVueforgeApp, type VueforgeContext } from '@vitorsreis/vueforge'
import App from './App.vue'

type StateContext = VueforgeContext & {
  state?: {
    count?: number
  }
}

export default createVueforgeApp<StateContext>((context) => {
  const count = (context.state?.count ?? 0) + 1
  context.state = { count }

  return createSSRApp(App, { count })
})
