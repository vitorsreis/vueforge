# CLI and configuration

VueForge uses the current working directory as the project root. A project with `src/App.vue` works without a configuration file.

## Commands

| Command                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `vueforge serve --dev` | Start development SSR with Vite middleware and browser HMR. |
| `vueforge build`       | Build the browser and server artifacts.                     |
| `vueforge serve`       | Start the production HTTP server from the artifacts.        |
| `vueforge render`      | Render one production request from standard input.          |
| `vueforge --help`      | Print command usage.                                        |

`serve` accepts `--host <host>` and `--port <port>`. Command-line values override the configuration file for that run.

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

| Option     | Default           | Description                                                                                        |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `host`     | `127.0.0.1`       | Hostname or IP address used by `serve`.                                                            |
| `port`     | `9901`            | TCP port from `1` through `65535`.                                                                 |
| `tempDir`  | `.vueforge`       | Directory for generated client and server artifacts. Relative paths resolve from the project root. |
| `vite`     | VueForge defaults | Vite options applied to development and production builds.                                         |
| `file`     | `src/App.vue`     | Project-relative `.vue` file used as the root component.                                           |
| `template` | None              | Inline Vue SFC source used as the root component.                                                  |
| `entry`    | None              | Project-relative module that creates a Vue app for each request.                                   |

`file`, `template`, and `entry` are mutually exclusive. Omit all three to use `src/App.vue`.

## Choosing a source

### Vue file

```ts
export default defineConfig({
  file: 'src/pages/Home.vue',
})
```

The file must be inside the project and use the `.vue` extension. VueForge passes declared root props to the component. Request `context` is available through a declared `context` prop and takes precedence over `props.context`.

### Inline SFC

```ts
export default defineConfig({
  template: `
    <script setup lang="ts">
    defineProps<{ title: string }>()
    </script>

    <template><h1>{{ title }}</h1></template>
  `,
})
```

Relative imports in the template resolve from the project root. The template is compiled by the same Vue plugin used for a file source.

### App entry

Use `entry` when the project already has a Vue app factory, router, store, or other per-request setup. The module must export a named `createApp` function or a default factory.

```ts
// src/entry.ts
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp(context, props) {
  const app = createSSRApp(App)
  app.provide('requestContext', context)
  return app
}
```

```ts
// vueforge.config.ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({ entry: 'src/entry.ts' })
```

VueForge calls the factory once for every server render and once during browser hydration. It passes `(context, props)`, where `context` is the request's optional object and `props` is the request's optional object. The factory may be asynchronous and may return the Vue app directly or an object containing `app`.

Use an entry factory to decide exactly which request values reach the app. When hydration is enabled, values included in the request are public to the browser.

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

`vueforge build` writes this layout by default:

```text
.vueforge/
  client/
    .vite/manifest.json
    .vite/vueforge-assets.json
    assets/
  server/
    entry.mjs
```

Use the same `tempDir` with `build`, `serve`, and `render`. Deploy both directories together. A production server must be restarted after a new build.

## Rendering from standard input

`vueforge render` reads one UTF-8 JSON request from standard input, up to 64 KiB, and writes one JSON response followed by a newline to standard output. It uses the production artifacts and opens no listener.

```sh
printf '%s\n' '{"props":{"title":"Hello"}}' | npx vueforge render
```

Diagnostics are written to standard error. With an interactive terminal as standard input, the command renders `{}`.

## Common errors

- `VueForge expects src/App.vue...` means the command was run from a directory without the default source.
- `choose only one of file, template, or entry` means more than one source option is configured.
- `Build artifacts are missing` means `vueforge build` has not run or the commands use different `tempDir` values.
- `Address already in use` means another process owns the selected port.
