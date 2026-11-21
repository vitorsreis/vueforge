import { defineConfig } from '@vitorsreis/vueforge'
import Invoice from './src/invoice.vue'

export default defineConfig({
  main: {
    home: 'src/home.vue',
    invoice: Invoice,
    inline: '<template><p>Inline catalog entry</p></template>',
  },
})
