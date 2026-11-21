import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  main: { directory: 'src/pages', pattern: /invoice/, extension: '.vue' },
})
