# Renderer architecture

The project fixes the root component. Each request supplies data for that component. A backend can make repeated calls to a running HTTP server or start a one-shot process using the production build.

## From request to HTML

1. The CLI resolves the project root and optional configuration. `vueforge serve` starts an HTTP listener with a development or production renderer. `vueforge render` loads the production renderer for one request.
2. `POST /render` reads the JSON request from HTTP. The one-shot command reads it from stdin. Both use the same request fields and size limit.
3. The server entry creates a fresh `createSSRApp(App, props)` and calls Vue's `renderToString` with an SSR context. The context contains the markup teleported to `head`. The result combines that markup and generated head entries with the rendered content.
4. `GET /` uses default props and enables hydration, then places the fragments in a complete HTML document. For backend-owned pages, the backend places `head` in `<head>` and `content` inside `#app`. The browser entry reads serialized props from the head and mounts an SSR app on `#app` to hydrate the markup.

Modules can live for the lifetime of the process. Each render gets a new Vue app. Keep request-specific state inside that app or a per-request factory. Mutable objects at module scope can be shared by concurrent requests. VueForge does not cache rendered HTML.

## Development

The VueForge plugin supplies virtual client and server entries that import `src/App.vue`. Vite runs as middleware on the same HTTP server. For each SSR call, VueForge requests the current entry from Vite's module runner. Vite reuses the module graph and invalidates changed modules. Browser HMR travels over Vite's WebSocket connection.

Development renders include inline `<style>` elements for the styles Vite discovers. Vite uses their `data-vite-dev-id` attributes to update those elements during HMR.

VueForge reads the style ID and CSS text from Vite's transformed CSS modules. It follows static imports and the Vue components recorded during SSR. CSS loaded only by a dynamic JavaScript import outside that graph arrives when the browser executes the import.

Vue 3.5 starts Teleport hydration at the target's first child. When the backend places metadata before the teleported markup, the client entry initializes Vue's hydration cursor at the first Teleport anchor. Keep the anchor comments when composing the page. The browser test covers both this Vue behavior and Vite's style IDs across dependency upgrades.

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

Ship the contents of both directories together and keep the renderer runtime available. Production reads the manifest to find the stylesheet assets and the client entry used for hydration. Each CLI process imports the server entry once. `vueforge serve` also serves static assets from the client directory. When using `vueforge render`, the backend serves the client assets at the URLs returned in `head`. The project configuration must resolve the same artifact location on the deployed host. The source component is only required during development and build.

## Boundaries for contributors

| Source                                          | Responsibility                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `bin/vueforge`                                  | Parse flags, load configuration and dispatch the command.                        |
| `src/index.ts`                                  | Public configuration helper and types shipped to consumers.                      |
| `src/config.ts`                                 | Read the config file, resolve paths and validate listener settings.              |
| `src/vite/vue-app.ts` and `src/build.ts`        | Define the virtual Vue entries and compile each target.                          |
| `src/server/serve.ts` and `render-route.ts`     | Start the listener, register routes and handle HTTP validation and errors.       |
| `src/server/development.ts` and `production.ts` | Load the appropriate SSR entry and provide the head assets and asset middleware. |
| `src/render/`                                   | Validate render requests and assemble head and content responses.                |
| `src/cli/render.ts`                             | Read a render request from stdin and write the response to stdout.               |

Project modules and configuration execute with the Node process's privileges. The HTTP API accepts JSON props for trusted project code. Request-selected files, inline SFC compilation, custom `defineApp` entries and URL/context injection for routing are design proposals outside the current API.

Run `npm run test:browser` from a source checkout to check backend-served hydration and development HMR in Chrome. Set `BROWSER_EXECUTABLE` to use a specific Chromium-based browser executable.
