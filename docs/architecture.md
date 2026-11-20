# Renderer architecture

VueForge keeps one Node process running so a backend can make repeated HTTP calls to a Vue application. The root component is fixed by the project. A request supplies data for that component.

## From request to HTML

1. On startup the CLI resolves the project root and optional configuration, selects the development or production renderer and opens the HTTP listener.
2. For `POST /render`, the HTTP layer parses the bounded JSON body and validates the root props.
3. The renderer calls the server entry, which creates a fresh `createSSRApp(App, props)` and calls Vue's `renderToString`. The route returns the resulting fragment as JSON.
4. For `GET /`, the server wraps a render with default props in an HTML document. The browser entry mounts an SSR app on `#app` to hydrate that markup.

Modules can live for the lifetime of the process. Each render gets a new Vue app. Keep request-specific state inside that app or a per-request factory. Mutable objects at module scope can be shared by concurrent requests. VueForge does not cache rendered HTML.

## Development

The VueForge plugin supplies virtual client and server entries that import `src/App.vue`. Vite runs as middleware on the same HTTP server. For each SSR call, VueForge requests the current entry from Vite's module runner. Vite reuses the module graph and invalidates changed modules. Browser HMR travels over Vite's WebSocket connection.

## Build and production

The first Vite build emits the browser entry, styles and client manifest. The second emits the SSR entry. With the default settings the layout is:

```text
.vueforge/
  client/
    .vite/manifest.json
    assets/
  server/
    entry.mjs
```

Ship the contents of both directories together and keep the renderer runtime available. Production reads the manifest to construct the document's script and stylesheet links, imports the server entry once, and serves static assets from the client directory. The project configuration must resolve the same artifact location on the deployed host. The source component is only required during development and build.

## Boundaries for contributors

| Source                                          | Responsibility                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `bin/vueforge`                                  | Parse flags, load configuration and dispatch the command.                       |
| `src/index.ts`                                  | Public configuration helper and types shipped to consumers.                     |
| `src/config.ts`                                 | Read the config file, resolve paths and validate listener settings.             |
| `src/vite/vue-app.ts` and `src/build.ts`        | Define the virtual Vue entries and compile each target.                         |
| `src/server/serve.ts` and `render-route.ts`     | Start the listener, register routes and handle HTTP validation and errors.      |
| `src/server/development.ts` and `production.ts` | Load the appropriate SSR entry and provide the HTML shell and asset middleware. |

Project modules and configuration execute with the Node process's privileges. The HTTP API accepts JSON props for trusted project code. Request-selected files, inline SFC compilation, custom `defineApp` entries and URL/context injection for routing are design proposals outside the current API.
