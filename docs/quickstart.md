# Quickstart

This guide creates a VueForge renderer beside an existing backend.

## 1. Create the Vue source

Create `src/App.vue`:

```vue
<script setup>
defineProps({
  title: { type: String, default: 'VueForge' },
})
</script>

<template>
  <main>
    <h1>{{ title }}</h1>
  </main>
</template>
```

## 2. Develop with HMR

```sh
npx vueforge serve --dev
```

The default listener is `http://127.0.0.1:9901`.

## 3. Render from the backend

```sh
curl --request POST \
  --header 'Content-Type: application/json' \
  --data '{"props":{"title":"Orders"}}' \
  http://127.0.0.1:9901/render
```

The JSON response contains ordered `head` entries and the rendered `content`.
The backend can place them into its own HTML document.

## 4. Build production artifacts

```sh
npx vueforge build
npx vueforge serve
```

The default final output is `dist/client` and `dist/server`. The temporary
staging directory is `.vueforge`.

## 5. Render once through stdio

```sh
printf '%s\n' '{"props":{"title":"Orders"}}' | npx vueforge render
```

Use `--format html` when VueForge should return a complete document:

```sh
printf '%s\n' '{}' | npx vueforge render --format html
```

## 6. Add a source configuration

Create `vueforge.config.ts` when the project needs a different source or
runtime setting:

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  source: 'src/App.vue',
  port: 9901,
  build: { outDir: 'dist' },
})
```

Continue with [configuration](configuration.md) and [backend integration](integration.md).
