# VueForge

VueForge renders a project-configured Vue source on the server, using `src/App.vue` by default. Your backend owns routes and business logic. Send JSON props and optional context over HTTP or stdin and get the page's head and body fragments, with optional browser hydration. In development, VueForge serves a hydrated preview with Vite hot module replacement (HMR).

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

The response is `{"head":"","content":"<h1>Hello</h1>"}`. Edit the component to see changes in development. Stop the development server with Ctrl+C before starting production on the same port.

## Build and serve

```sh
npx vueforge build
npx vueforge serve
```

Run both commands from the same project root. The build creates browser and server artifacts under `.vueforge/`. The production process loads them at startup. After building a new version, restart the process to load it.

For a single render after building, pipe a JSON request to `npx vueforge render`. The command writes the same JSON response to stdout and exits without opening an HTTP listener.

```sh
printf '%s\n' '{"props":{"title":"Hello"}}' | npx vueforge render
```

## Guides

- [CLI and configuration](docs/configuration.md) covers commands, source selection, defaults, overrides, and Vite integration.
- [HTTP API](docs/http-api.md) covers the three routes, response formats, and how to hydrate a page served by your backend.
- [Renderer architecture](docs/architecture.md) explains source loading, hydration, request isolation, HMR, and production artifacts.
- [Contributing](CONTRIBUTING.md), [releases](docs/releases.md), and [security reporting](SECURITY.md) describe project maintenance.

Licensed under the [MIT License](LICENSE).
