# Renderer architecture

The project chooses its root source in configuration: `file`, `template` or `entry`. With none selected, VueForge uses `src/App.vue`. Each request supplies props and optional public context. A backend can make repeated calls to a running HTTP server or start a one-shot process using the production build.

## From request to HTML

1. The CLI resolves the project root and optional configuration. `vueforge serve` starts an HTTP listener with a development or production renderer. `vueforge render` loads the production renderer for one request.
2. `POST /render` reads the JSON request from HTTP. The one-shot command reads it from stdin. Both use the same request fields and size limit.
3. The server entry creates a fresh Vue app for the selected source and calls Vue's `renderToString` with an SSR context. For `file` and `template`, request context is passed as the root `context` prop, taking precedence over `props.context`. An `entry` source is a project-relative local module that exports a shared Vue SSR factory (`createApp` or default). VueForge awaits the result and uses the app directly or reads its `app` property. The SSR context contains the markup teleported to `head`. The result combines that markup and generated head entries with the rendered content.
4. The backend places `head` in `<head>` and `content` inside `#app`. The browser entry reads serialized props and context from the head and mounts an SSR app on `#app` to hydrate the markup.

Modules can live for the lifetime of the process. Each render gets a new Vue app. Keep request-specific state inside that app or a per-request factory. Mutable objects at module scope can be shared by concurrent requests. VueForge does not cache rendered HTML.

## Development

The VueForge plugin supplies virtual client and server entries for the configured source. Inline `template` SFC imports resolve relative to the project root. Vite runs as middleware on the same HTTP server. For each SSR call, VueForge requests the current entry from Vite's module runner. Vite reuses the module graph and invalidates changed modules. Browser HMR travels over Vite's WebSocket connection.

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

Project modules and configuration execute with the Node process's privileges, so project source selection is trusted configuration and never comes from the request body. Validate externally supplied props and context keys before using them. Each request gets a fresh Vue app; keep mutable request-specific state inside that app or its factory. With hydration enabled, the complete context is serialized for the browser and is public. Server rendering and hydration must use the same context.

Run `npm run test:browser` from a source checkout to check backend-served hydration and development HMR in Chrome. Set `BROWSER_EXECUTABLE` to use a specific Chromium-based browser executable.
