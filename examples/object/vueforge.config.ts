import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  main: {
    home: 'src/home.vue',
    inline: '<template><p>Inline catalog entry</p></template>',
  },
})
