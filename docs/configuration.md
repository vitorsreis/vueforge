# CLI and configuration

VueForge treats the current working directory as the project root. With `src/App.vue` present, development and build work with zero configuration. Run `vueforge --help` to list the commands. Use `npx vueforge` when the executable is installed locally.

| Command                      | Behavior                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `vueforge serve --dev`       | Start an HTTP server with Vite transforms, browser HMR and live SSR updates.     |
| `vueforge build`             | Compile the browser bundle, client manifest and server entry, then exit.         |
| `vueforge serve`             | Load a completed build and serve HTTP.                                           |
| `vueforge render`            | Load a completed build, render once using stdin, write JSON to stdout, and exit. |
| `vueforge`, `--help` or `-h` | Print usage and exit.                                                            |

Both forms of `serve` accept `--host <host>` and `--port <port>`. For example, `vueforge serve --dev --port 4400` overrides the configured listener port for this invocation.

## Rendering from stdin

Run `vueforge build` from the project root first. `vueforge render` uses the production artifacts selected by `tempDir` and opens no listener. It reads one UTF-8 JSON request up to 64 KiB through end of input. With stdin connected to a terminal, it uses `{}` immediately. The request fields and the `{head, content}` response match [POST /render](http-api.md#post-render).

On success, stdout contains one JSON response followed by a newline. Diagnostics go to stderr. On failure, the command exits with a nonzero status and writes the error to stderr.

## Project settings

Place the optional `vueforge.config.ts` beside the project's `src/` directory. The public package exports the `defineConfig` helper and the TypeScript type `VueForgeConfig`. The helper returns the supplied object and provides editor completion. Defaults are applied by the CLI.

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  host: '127.0.0.1',
  port: 4300,
  tempDir: '.cache/vueforge',
  vite: {
    define: { __APP_NAME__: JSON.stringify('My app') },
  },
})
```

| Option     | Default                  | Meaning                                                                                                                                                                                               |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host`     | `127.0.0.1`              | Listener hostname or IP. A CLI flag takes precedence over the file.                                                                                                                                   |
| `port`     | `9901`                   | TCP port from 1 through 65535. A CLI flag takes precedence over the file.                                                                                                                             |
| `tempDir`  | `.vueforge`              | Directory dedicated to generated artifacts. Absolute paths are accepted. Relative paths resolve from the project root. Keep the same setting during build, production serving and one-shot rendering. |
| `vite`     | Built-in Vue integration | Vite options such as aliases, compile-time definitions and additional plugins, passed to development and both builds.                                                                                 |
| `file`     | `src/App.vue`            | Project-relative Vue SFC used as the root component. Mutually exclusive with `template` and `entry`.                                                                                                  |
| `template` | —                        | Inline Vue SFC source used as the root component. Relative imports resolve from the project root. Mutually exclusive with `file` and `entry`.                                                         |
| `entry`    | —                        | Project-relative local module that exports a Vue SSR app factory. Mutually exclusive with `file` and `template`.                                                                                      |

By default VueForge uses `src/App.vue`. To select a source, set exactly one of `file`, `template` or `entry` in `vueforge.config.ts`:

```ts
import { defineConfig } from '@vitorsreis/vueforge'

export default defineConfig({
  file: 'src/pages/Home.vue',
})
```

Point `entry` at the module shared by your server and browser. VueForge calls its named `createApp` export once per render and again for browser hydration. A default-exported factory also works. The factory may be async and may return either the Vue app or an object containing `app`, such as `{ app, store }`. The shared module creates the app and leaves mounting to the browser entry. [Vue SSR guide](https://vuejs.org/guide/scaling-up/ssr.html#code-structure)

```ts
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  return createSSRApp(App)
}
```

Factories that need request data can accept `(context, props)`. An omitted context arrives as `undefined` and omitted props arrive as `{}`.

HTTP and CLI render requests may include an optional JSON object `context`. For `file` and `template`, VueForge passes it as the root component's `context` prop; this takes precedence over `props.context`. With hydration enabled, `context` is serialized for the browser, so it is fully public. Keep the same context available for server rendering and hydration.

VueForge supplies the Vue plugin, virtual entries, project root and base URL (`/`). It selects middleware mode for development and controls build entries, output layout and the client manifest. Put listener settings at the top level. Supply application-specific Vite options through `vite` in this file. The embedded server disables separate Vite config-file discovery.

## Startup errors

- **Missing component:** run development or build from the directory containing `src/App.vue`.
- **Missing artifacts:** run `vueforge build` and verify that `vueforge serve` or `vueforge render` uses the same `tempDir`. Deploy both the `client/` and `server/` directories, including the hidden client manifest.
- **Address already in use:** stop the existing listener or choose another port with `--port`.
- **Config changes:** restart the CLI after editing listener or renderer configuration. Component edits use the development module graph.
