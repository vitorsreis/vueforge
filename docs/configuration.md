# Configuration and CLI

Vueforge is zero-config when a project contains `src/App.vue`. Add
`vueforge.config.ts` when the project needs a different `main` source, server
settings, or build settings.

## Commands

```sh
vueforge serve [--dev]
vueforge build
printf '%s\n' '{"props":{"title":"Hello"}}' | vueforge render
```

`serve --dev` runs the Vite SSR module runner and HMR. Without `--dev`, `serve`
uses `mode` from `vueforge.config.ts` when it is set and otherwise uses the
last production build. `build` writes browser and SSR artifacts. `render` reads one
JSON request from standard input and writes one response to standard output.

Global options are `-r, --root`, `-c, --config`, `-h, --help`, and
`-v, --version`. `serve` accepts transport, TLS, shutdown, and render-limit
overrides. `render` accepts `-f, --format`, `--pretty`, `--hydrate`,
`--template`, and `--max-request-bytes`.

| Command  | Options                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serve`  | `--dev`, `--host`, `--port`, `--unix`, `--stdio`, `--ssl-cert`, `--ssl-key`, `--ssl-ca`, `--shutdown-timeout-ms`, `--max-request-bytes`, `--max-output-bytes`, `--render-timeout-ms`, `--max-concurrent-renders` |
| `build`  | Global options                                                                                                                                                                                                   |
| `render` | `--format`, `--hydrate`, `--template`, `--pretty`, `--max-request-bytes`                                                                                                                                         |

All numeric CLI limits must be positive safe integers. `--max-request-bytes`
is accepted by both `serve` and `render`. The other resource-limit overrides
apply to `serve`.

## Application selection

Configure one `main` source. It can be a component, inline SFC, entry module,
directory, regular expression, named object, or factory.

### Component or inline SFC

`main` accepts a `.vue` path, an imported component, or an inline SFC.

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  main: 'src/pages/Home.vue',
})
```

```ts
import Home from './src/pages/Home.vue'
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({ main: Home })
```

```ts
export default {
  main: '<template><h1>{{ title }}</h1></template>',
}
```

When omitted, `main` defaults to `src/App.vue`.

### App factory

An entry module in `main` creates a fresh Vue app for each request. The
module exports `createApp` or a default factory. The factory receives
`(context)` and may return the app or `{ app }`.

```ts
// src/entry.ts
import { createSSRApp } from 'vue'
import { createVueforgeApp } from '@vitorsreis/vueforge'
import App from './App.vue'

export default createVueforgeApp((context) => {
  const app = createSSRApp(App, context.props)
  app.provide('requestContext', context)
  return app
})
```

```ts
// vueforge.config.ts
export default { main: 'src/entry.ts' }
```

Use a factory for request-scoped routers, stores, and plugins. Do not keep
request data in module-level mutable state.

### Template catalogs

`main` can be a directory containing `.vue` files, a regular expression, or a
named object. A request must include `template` in the query when this option
is used. Directory names are
relative to the project root and become template names without `.vue`.

```ts
export default {
  main: 'src/pages',
}
```

```json
POST /render?template=invoice
{ "props": { "number": "A-42" } }
```

```ts
import Invoice from './src/pages/Invoice.vue'

export default {
  main: {
    home: 'src/pages/Home.vue',
    invoice: Invoice,
    inline: '<template><p>Inline</p></template>',
  },
}
```

The catalog is compiled with the project and is limited to the configured
names. Arbitrary paths and source code are never loaded from a request.

## Server

Server settings belong under `server`.

```ts
export default {
  server: {
    host: '127.0.0.1',
    port: 9901,
    cors: true,
  },
}
```

The default transport is TCP on `127.0.0.1:9901`. Use `server.unix` for a Unix
socket or `server.stdio` for newline-delimited JSON. These transports are
mutually exclusive. The CLI `--stdio` option overrides the configuration.
`server.ssl` enables HTTPS with `key`, `cert`, and an optional `ca` file.

CORS is enabled by default. Set `cors: false` to disable it, pass a string array
to allow explicit origins, or pass the full options object.

The same setting is applied to Vite's development asset middleware, so browser
requests to `/@vite/client` and `/@vueforge/client` follow the server policy.

```ts
export default {
  server: {
    cors: {
      origin: ['https://admin.example.test'],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
    },
  },
}
```

`server.shutdownTimeoutMs` bounds graceful shutdown. The CLI overrides server
transport, TLS, and resource-limit values for one invocation. Transport flags
`--host` and `--port` cannot be combined with `--unix` or `--stdio`. Unix
sockets and stdio are mutually exclusive.

Set `mode: 'development'` when the project should start development SSR without
passing `serve --dev`:

```ts
export default {
  mode: 'development',
}
```

The `--dev` flag always takes precedence for that invocation.

## Build and limits

```ts
export default {
  tempDir: '.vueforge',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
  },
  limits: {
    maxRequestBytes: 65536,
    maxConcurrentRenders: 4,
    renderTimeoutMs: 5000,
    maxOutputBytes: 4194304,
  },
}
```

`tempDir` stores build locks and staging files. `build.outDir` stores the
published `client` and `server` artifacts used by production `serve` and
`render`. `maxOutputBytes` bounds the serialized response and the request
context transferred from production SSR workers.

## Vite and asset URLs

Vueforge loads `vite.config.ts` when present and merges the optional `vite`
property from `vueforge.config.ts` on top of it. Vueforge owns its virtual
entrypoints and output layout.

Use `base` when the backend exposes Vueforge below a path. Use `origin` when the
browser connects directly to another origin.

```ts
export default {
  base: '/admin/',
  origin: 'https://frontend.example.test',
}
```

## HTML documents

`?format=html` returns a complete document. Configure the wrapper with
`document`.

```ts
export default {
  document: {
    rootId: 'app',
    htmlAttrs: { lang: 'pt-BR' },
    bodyAttrs: { class: 'application' },
    head: [{ tag: 'meta', attrs: { charset: 'utf-8' } }],
  },
}
```

Use `?format=json` when the backend owns document composition. JSON is compact
by default. Add `?pretty=1` to HTTP requests or `--pretty` to the CLI when a
human-readable JSON response is needed.

When hydration is enabled, the client uses `document.rootId`. The default is
`app`, and a custom value works for both the generated document and the browser
entrypoint.
