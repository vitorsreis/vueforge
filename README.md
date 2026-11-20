# VueForge

VueForge runs a persistent Vue server-side renderer. Keep routes and business logic in your backend, send JSON props over HTTP, and receive HTML rendered by your project's `src/App.vue`. For browser development, VueForge also serves a hydrated page with Vite hot module replacement (HMR).

## Try your first render

Use Node.js 26 and npm. VueForge is distributed as a package tarball through the GitHub release workflow. In a Vue project, install the downloaded archive with `npm install ./vueforge-<version>.tgz`, substituting its actual filename. For a source checkout, see [Contributing](CONTRIBUTING.md).

Create `src/App.vue` in the project you want to render:

```vue
<script setup>
defineProps({ title: { type: String, default: 'VueForge' } })
</script>

<template>
  <h1>{{ title }}</h1>
</template>
```

From that project's root, run `npx vueforge serve --dev`. Open `http://127.0.0.1:9901/` to see the default title. In a second terminal, send a render request (POSIX shell):

```sh
curl --json '{"props":{"title":"Hello"}}' http://127.0.0.1:9901/render
```

The response is `{"html":"<h1>Hello</h1>"}`. Edit the component to see changes in development. Stop the development server with Ctrl+C before starting production on the same port.

## Build and serve

```sh
npx vueforge build
npx vueforge serve
```

Run both commands from the same project root. The build creates browser and server artifacts under `.vueforge/`. The production process loads them at startup. After building a new version, restart the process to load it.

## Guides

- [CLI and configuration](docs/configuration.md) covers commands, defaults, overrides, and Vite integration.
- [HTTP API](docs/http-api.md) covers the three routes, request and response formats, and errors.
- [Renderer architecture](docs/architecture.md) explains hydration, request isolation, HMR, production artifacts, and planned features.
- [Contributing](CONTRIBUTING.md), [releases](docs/releases.md), and [security reporting](SECURITY.md) describe project maintenance.

Licensed under the [MIT License](LICENSE).
