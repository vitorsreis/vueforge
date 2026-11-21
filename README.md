# VueForge

VueForge is a Vue 3 SSR service for applications whose backend is written in any language. It runs beside your backend, renders a configured Vue source, and returns the document head and body fragments over HTTP or standard input. Development mode uses Vite and HMR. Production mode uses the artifacts created by `vueforge build`.

## Requirements

- Node.js 26
- A Vue 3 project
- npm

## Install

When a release is available, install the package in the Vue project that you want to render:

```sh
npm install @vitorsreis/vueforge
```

The repository has not published its first release yet. To work from a checkout, run `npm ci` in the repository and use `node bin/vueforge` from the target project.

VueForge does not replace your backend router. Your backend decides which URLs to serve, calls VueForge when it needs HTML, and composes the returned fragments into the document.

## Quick start

Create `src/App.vue` in your project:

```vue
<script setup>
defineProps({
  title: { type: String, default: 'VueForge' },
})
</script>

<template>
  <h1>{{ title }}</h1>
</template>
```

Start the development server:

```sh
npx vueforge serve --dev
```

The default address is `http://127.0.0.1:9901`. Render the component from another process:

```sh
curl --json '{"props":{"title":"Hello"}}' http://127.0.0.1:9901/render
```

The response is:

```json
{ "head": "", "content": "<h1>Hello</h1>" }
```

Edit `src/App.vue` while the server is running. Vite reloads the SSR module and browser HMR updates hydrated pages.

## Production

Build the project and start the production server:

```sh
npx vueforge build
npx vueforge serve
```

The default build directory is `.vueforge`. Build and serve must use the same project root and `tempDir` setting. Restart the production process after creating a new build.

For a single render without opening an HTTP listener, send one JSON request to standard input:

```sh
printf '%s\n' '{"props":{"title":"Hello"}}' | npx vueforge render
```

The command writes the same response shape as `POST /render` to standard output. Use
`--format json` to force the JSON response envelope or `--format html` to write a
complete neutral HTML document. The CLI option overrides a `format` value in stdin.

```sh
printf '%s\n' '{"props":{"title":"Hello"}}' | npx vueforge render --format html
```

## Commands

| Command                | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `vueforge serve --dev` | Start development SSR, Vite middleware, and HMR.           |
| `vueforge build`       | Create the browser and server artifacts under `.vueforge`. |
| `vueforge serve`       | Start the production HTTP server from a completed build.   |
| `vueforge render`      | Render one production request from standard input.         |
| `vueforge --help`      | Print command usage.                                       |
| `vueforge --version`   | Print the installed package version.                       |

Use `--host` and `--port` with `serve` to override the configuration for one run.
Use `--config <path>` with any command to select a JavaScript or TypeScript
VueForge configuration file. Run `vueforge <command> --help` for command-specific
options.

## Configuration

No configuration file is required for `src/App.vue`, `127.0.0.1`, port `9901`, and `.vueforge`. VueForge also loads a standard `vite.config.ts` when the project has one. Add `vueforge.config.ts` when the project needs a different source, listener, artifact directory, or VueForge-specific Vite override.

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  file: 'src/pages/Home.vue',
  host: '127.0.0.1',
  port: 9901,
  tempDir: '.vueforge',
})
```

See [CLI and configuration](docs/configuration.md) for source modes and request context. Development render failures can return a detailed HTML or JSON diagnostic, as described in [HTTP API](docs/http-api.md#development-diagnostics).

## HTTP integration

The service exposes:

- `GET /` for a JSON welcome response and package version
- `GET /healthz` for a no-store liveness response
- `POST /render` for SSR output

The caller owns the document. Put `head` in `<head>` and `content` inside the element that will contain the Vue app. See [HTTP API](docs/http-api.md) for request validation, hydration, styles, Teleport, and error handling.

## Documentation

- [Documentation index](docs/README.md)
- [CLI and configuration](docs/configuration.md)
- [HTTP API](docs/http-api.md)
- [Backend integration](docs/integration.md)
- [Operations](docs/operations.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

VueForge is available under the [MIT License](LICENSE).
