import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  main: `
    <script setup>
      defineProps({ name: String })
    </script>
    <template>
      <h1>Hello {{ name ?? "Vueforge" }}</h1>
    </template>
  `,
})
