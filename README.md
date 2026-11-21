# Vueforge

[![CI](https://github.com/vitorsreis/vueforge/actions/workflows/ci.yml/badge.svg)](https://github.com/vitorsreis/vueforge/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40vitorsreis%2Fvueforge)](https://www.npmjs.com/package/@vitorsreis/vueforge)
[![license](https://img.shields.io/github/license/vitorsreis/vueforge)](LICENSE)

Vueforge is a long-lived Vue 3 SSR process for backends written in any
language. Your backend keeps routing, authentication, data loading, and final
document composition. Vueforge handles Vue compilation, SSR, browser assets,
HMR, and production workers.

## Why Vueforge

- Develop with Vite SSR and browser HMR without changing your backend.
- Render one component, one app factory, or a named catalog of templates.
- Choose JSON fragments for backend-owned documents or complete HTML documents.
- Use HTTP, Unix sockets, or JSONL standard input.
- Keep production rendering isolated behind bounded workers.

## Install

```sh
npm install @vitorsreis/vueforge
```

## Quick start

Put `src/App.vue` in a project and start development SSR:

```sh
npx vueforge serve --dev
```

Render from any backend:

```sh
curl -X POST http://127.0.0.1:9901/render \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Hello"}}'
```

```json
{
  "head": [
    { "tag": "script", "attrs": { "type": "module", "src": "/@vite/client" } },
    { "tag": "script", "attrs": { "type": "module", "src": "/@vueforge/client" }}
  ],
  "content": "<h1>Hello</h1>"
}
```

Build and serve production artifacts:

```sh
npx vueforge build
npx vueforge serve
```

## Select an app

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  main: 'src/App.vue',
  server: { port: 9901 },
})
```

Use `main: 'src/entry.ts'` for a request-scoped Vue app factory. Use a directory,
regular expression, or named object for Twig-like template selection. The
[configuration guide](docs/configuration.md) documents the source forms.

## Documentation

- [Quickstart](docs/quickstart.md)
- [Configuration and CLI](docs/configuration.md)
- [HTTP API](docs/http-api.md)
- [Backend integration](docs/integration.md)
- [Operations](docs/operations.md)
- [Architecture](docs/architecture.md)
- [Examples](examples/README.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

MIT © [Vitor Reis](https://github.com/vitorsreis)
