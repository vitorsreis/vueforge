# Quickstart

This guide adds Vue SSR beside an existing backend.

## 1. Create a component

Create `src/App.vue`:

```vue
<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <main>
    <h1>{{ title ?? 'Hello from Vueforge' }}</h1>
  </main>
</template>
```

## 2. Start development SSR

```sh
npx vueforge serve --dev
```

The default listener is `http://127.0.0.1:9901`. Vite serves the development
modules and Vueforge adds the HMR client to hydrated responses.

## 3. Render from the backend

```sh
curl --request POST \
  --header 'Content-Type: application/json' \
  --data '{"props":{"title":"Orders"}}' \
  http://127.0.0.1:9901/render
```

The JSON response contains `head` entries and the `content` fragment. Insert
`head` into the document head and `content` into the Vue root element.

## 4. Request a complete document

```sh
curl --request POST \
  --header 'Accept: text/html' \
  --header 'Content-Type: application/json' \
  --data '{"props":{"title":"Orders"}}' \
  http://127.0.0.1:9901/render
```

Configure the document wrapper when the returned HTML needs language or body
attributes.

## 5. Build production artifacts

```sh
npx vueforge build
npx vueforge serve
```

The production server reads `build.outDir`, which defaults to `dist`.

## 6. Choose an application source

Use `main: 'src/entry.ts'` when the app needs request-scoped plugins or stores.
Use `main: 'src/catalog'` when the backend chooses a named `.vue` view.

```json
POST /render?template=invoice
{ "props": { "number": "A-42" } }
```

See [configuration](configuration.md) for inline SFCs, imported components,
transport options, limits, TLS, CORS, and Vite integration.
