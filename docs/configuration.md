# CLI and configuration

VueForge treats the current working directory as the project root. With `src/App.vue` present, development and build work with zero configuration. Run `vueforge --help` to list the commands. Use `npx vueforge` when the executable is installed locally.

| Command                      | Behavior                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `vueforge serve --dev`       | Start an HTTP server with Vite transforms, browser HMR and live SSR updates. |
| `vueforge build`             | Compile the browser bundle, client manifest and server entry, then exit.     |
| `vueforge serve`             | Load a completed build and serve HTTP.                                       |
| `vueforge`, `--help` or `-h` | Print usage and exit.                                                        |

Both forms of `serve` accept `--host <host>` and `--port <port>`. For example, `vueforge serve --dev --port 4400` overrides the configured listener port for this invocation.

## Project settings

Place the optional `vueforge.config.ts` beside the project's `src/` directory. The public package exports the `defineConfig` helper and the TypeScript type `VueForgeConfig`. The helper returns the supplied object and provides editor completion. Defaults are applied by the CLI.

```ts
import { defineConfig } from 'vueforge'

export default defineConfig({
  host: '127.0.0.1',
  port: 4300,
  tempDir: '.cache/vueforge',
  vite: {
    define: { __APP_NAME__: JSON.stringify('My app') },
  },
})
```

| Option    | Default                  | Meaning                                                                                                                                                                           |
| --------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host`    | `127.0.0.1`              | Listener hostname or IP. A CLI flag takes precedence over the file.                                                                                                               |
| `port`    | `9901`                   | TCP port from 1 through 65535. A CLI flag takes precedence over the file.                                                                                                         |
| `tempDir` | `.vueforge`              | Directory dedicated to generated artifacts. Absolute paths are accepted. Relative paths resolve from the project root. Keep the same setting during build and production serving. |
| `vite`    | Built-in Vue integration | Vite options such as aliases, compile-time definitions and additional plugins, passed to development and both builds.                                                             |

VueForge supplies the Vue plugin, virtual entries, project root and base URL (`/`). It selects middleware mode for development and controls build entries, output layout and the client manifest. Put listener settings at the top level. Supply application-specific Vite options through `vite` in this file. The embedded server disables separate Vite config-file discovery.

## Startup errors

- **Missing component:** run development or build from the directory containing `src/App.vue`.
- **Missing artifacts:** run `vueforge build` and verify that production uses the same `tempDir`. Deploy both the `client/` and `server/` directories, including the hidden client manifest.
- **Address already in use:** stop the existing listener or choose another port with `--port`.
- **Config changes:** restart the CLI after editing listener or renderer configuration. Component edits use the development module graph.
