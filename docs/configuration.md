# CLI and configuration

VueForge resolves a project from `root`. The CLI defaults `root` to the current working directory. A project containing `src/App.vue` needs no source setting.

## Commands

| Command                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `vueforge serve`       | Start the HTTP renderer.                                    |
| `vueforge serve --dev` | Start development SSR with Vite middleware and browser HMR. |
| `vueforge build`       | Build the browser and server artifacts.                     |
| `vueforge render`      | Render one production request from standard input.          |
| `vueforge --help`      | Print command usage.                                        |
| `vueforge --version`   | Print the installed package version.                        |

Global options include `--root <path>`, `--config <path>`, `--help`, and
`--version`. `serve` also accepts `--host`, `--port`, `--unix`, `--stdio`, TLS
file options, and resource-limit options. `render` accepts `--format json|html`
and `--max-request-bytes`. Command-line values take precedence over the
configuration file.

Use `vueforge --help` for global options and `vueforge <command> --help` for the
options and input contract of one command.

```sh
npx vueforge serve --dev --host 127.0.0.1 --port 9901
```

The default listener is `127.0.0.1:9901`.

## Configuration file

Create `vueforge.config.ts` in the project root. The package exports `defineConfig` for type checking and editor completion.

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  host: '127.0.0.1',
  port: 9901,
  tempDir: '.vueforge',
  vite: {
    resolve: {
      alias: {
        '@': './src',
      },
    },
  },
})
```

### Options

| Option     | Default              | Description                                                                  |
| ---------- | -------------------- | ---------------------------------------------------------------------------- |
| `host`     | `127.0.0.1`          | Hostname or IP address used by `serve`.                                      |
| `port`     | `9901`               | TCP port from `1` through `65535`.                                           |
| `tempDir`  | `.vueforge`          | Temporary staging and lock directory. Relative paths resolve from `root`.    |
| `root`     | current directory    | Project root used to resolve source, config, and artifacts.                  |
| `unix`     | None                 | Unix socket path. It cannot be combined with `host` or `port`.               |
| `ssl`      | None                 | TLS settings for TCP serving. Requires `cert` and `key`, with optional `ca`. |
| `build`    | `{ outDir: 'dist' }` | Final output directory and Vite `sourcemap`/`minify` options.                |
| `limits`   | See below            | Request, concurrency, timeout, and output-size limits.                       |
| `document` | See below            | Complete HTML document options used by `format: "html"`.                     |
| `vite`     | VueForge defaults    | Vite options applied to development and production builds.                   |
| `source`   | `src/App.vue`        | Inline SFC, imported component, `.vue` path, or app factory module path.     |

Omit `source` to use `src/App.vue`. The value is classified by its type and content.

TCP is the default HTTP transport. `--stdio` is a CLI-only newline-delimited
JSON transport and cannot be combined with `--unix`.

`limits` defaults to `maxRequestBytes: 65536`, `maxConcurrentRenders: 4`,
`renderTimeoutMs: 5000`, and `maxOutputBytes: 4194304`.

`document` defaults to `doctype: "<!doctype html>"`, `rootId: "app"`, empty
`htmlAttrs`, empty `bodyAttrs`, and an empty `head` list. `head` entries are
emitted before render-generated head entries.

## Choosing a source

### Vue component

```ts
export default defineConfig({
  source: 'src/pages/Home.vue',
})
```

An imported Vue single-file component can be supplied as `source`.

```ts
import { defineConfig } from '@vitorsreis/vueforge'
import Home from './src/pages/Home.vue'

export default defineConfig({ source: Home })
```

The component must come from a `.vue` file inside the project. VueForge passes declared root props to the component. Request `context` is available through a declared `context` prop and takes precedence over `props.context`.

### Inline SFC

```ts
export default defineConfig({
  source: `
    <script setup lang="ts">
    defineProps<{ title: string }>()
    </script>

    <template><h1>{{ title }}</h1></template>
  `,
})
```

Relative imports in an inline SFC resolve from the project root. The SFC is compiled by the same Vue plugin used for a file source.

### Factory module

Use a factory module path in `source` when the project already has a Vue app factory, router, store, or other per-request setup. The module must export a named `createApp` function or a default factory.

```ts
// src/entry.ts
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp(
  context: Record<string, unknown> | undefined,
  props: Record<string, unknown>,
) {
  const app = createSSRApp(App, props)
  app.provide('requestContext', context)
  return app
}
```

```ts
// vueforge.config.ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({ source: 'src/entry.ts' })
```

VueForge calls the factory once for every server render and once during browser hydration. It passes `(context, props)`. `context` is `undefined` when omitted and `props` defaults to `{}`. The factory may be asynchronous and may return the Vue app directly or an object containing `app`.

Use the factory to decide exactly which request values reach the app. When hydration is enabled, values included in the request are public to the browser.

### Source inference

- Omitted `source` uses `src/App.vue`.
- An imported Vue component is resolved as a component.
- A string beginning with `<template`, `<script`, or `<style` is an inline SFC.
- A `.vue` path is resolved as a component.
- Other supported source paths are loaded as factory modules.

## Vite options

VueForge loads `vite.config.ts` when it exists. It uses the same `command` and `mode` values as the current CLI command, so Vite config functions can distinguish development and production.

Put project-specific Vite settings in `vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

The optional `vite` property in `vueforge.config.ts` is merged on top of the Vite config file. Use it for VueForge-specific overrides or settings that belong beside the source selection:

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  vite: {
    define: { __APP_NAME__: JSON.stringify('Orders') },
  },
})
```

VueForge controls the project root, base URL, Vue plugin, virtual client and server entries, and build output directories. Those internal values take precedence so development, build, and production keep the same entrypoints and artifact layout.

## Build artifacts

`vueforge build` writes this layout under `build.outDir`, which defaults to `dist`:

```text
dist/
  client/
    .vite/manifest.json
    .vite/vueforge-assets.json
    assets/
  server/
    entry.mjs
```

`tempDir` is used only while building. Use the same `build.outDir` with `build`, `serve`, and `render`. Deploy both directories together. A production server must be restarted after a new build.

## Rendering from standard input

`vueforge render` reads one UTF-8 JSON request from standard input, up to 64 KiB,
and writes one response to standard output. It uses the production artifacts and
opens no listener. JSON is the default CLI output. Pass `--format json` to force the
JSON response envelope or `--format html` to write a complete document.

```sh
printf '%s\n' '{"props":{"title":"Hello"}}' | npx vueforge render
```

The HTML output places the rendered head entries inside `<head>` and the rendered
content inside `<div id="app">`.

```sh
printf '%s\n' '{"props":{"title":"Hello"}}' | npx vueforge render --format html
```

Diagnostics are written to standard error. With an interactive terminal as standard input, the command renders `{}`.

## Common errors

- `VueForge expects src/App.vue...` means the command was run from a directory without the default source.
- `source must be a non-empty value` means the configured source is invalid.
- `Build artifacts are missing` means `vueforge build` has not run or the commands use different `build.outDir` values.
- `Address already in use` means another process owns the selected port.
