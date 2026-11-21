# VueForge

[![CI](https://github.com/vitorsreis/vueforge/actions/workflows/ci.yml/badge.svg)](https://github.com/vitorsreis/vueforge/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40vitorsreis%2Fvueforge)](https://www.npmjs.com/package/@vitorsreis/vueforge)
[![license](https://img.shields.io/github/license/vitorsreis/vueforge)](LICENSE)

VueForge gives any backend a long-lived Vue 3 SSR process. A Rails, Laravel,
Django, Go, Rust, Python, PHP, or other application can send props and request
context to VueForge, receive rendered HTML, and keep its own routing and page
composition.

It provides one small workflow for development and production:

- Vite SSR and HMR while developing.
- A production build with reusable browser and server artifacts.
- HTTP, Unix socket, and JSONL stdio transports.
- Node.js and Bun adapters.
- JSON fragments or complete HTML documents.

## Install

```sh
npm install @vitorsreis/vueforge
```

## Start

With `src/App.vue`, no configuration is required:

```sh
npx vueforge serve --dev
```

Then render from any backend or command line:

```sh
curl --json '{"props":{"title":"Hello"}}' \
  http://127.0.0.1:9901/render
```

The response is a small contract that your backend can place in its document:

```json
{
  "head": [],
  "content": "<h1>Hello</h1>"
}
```

The complete setup is in the [quickstart guide](docs/quickstart.md).

## Configure

The public source entry is a single `source` value. It can be a Vue component,
an inline SFC, a `.vue` path, or a factory module path:

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  source: 'src/App.vue',
  port: 9901,
})
```

See [configuration](docs/configuration.md) for source inference, Vite merging,
transport settings, limits, documents, and build output.

## Commands

```sh
vueforge serve --dev
vueforge build
vueforge serve
printf '%s\n' '{"props":{"title":"Hello"}}' | vueforge render
```

Use `vueforge --help` or `vueforge <command> --help` for the complete CLI
contract.

## Documentation

- [Quickstart](docs/quickstart.md)
- [Configuration and CLI](docs/configuration.md)
- [HTTP API](docs/http-api.md)
- [Backend integration](docs/integration.md)
- [Operations](docs/operations.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

MIT © [Vitor Reis](https://github.com/vitorsreis)
