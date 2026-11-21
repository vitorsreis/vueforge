# Backend integration

Vueforge is a renderer service. Your backend keeps ownership of routes, authentication, data loading, and the final HTML document.

## Render a page

Send the data required by the configured Vue template or entry to `POST /render`:

```json
{
  "props": { "title": "Orders" },
  "context": { "locale": "en-US" }
}
```

Use `format: "html"` when the backend wants Vueforge to return the complete document. Use `format: "json"` when the backend composes the document itself. When `format` is omitted, the server negotiates with `Accept`, then configuration, then defaults to JSON.

The caller composes the response document:

```text
backend route
  -> POST /render
  -> put response.head inside <head>
  -> put response.content inside <div id="app">
  -> return the document
```

The JSON response is fragment-oriented. The HTML response uses the configured `document` options for doctype, root id, attributes, and extra head entries.

When `templates` is configured, include the selected name in the request:

```json
{
  "template": "invoice",
  "props": { "number": "A-42" }
}
```

## Hydrate in the browser

Set `hydrate` to `true` and preserve the returned head nodes in the document:

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- response.head -->
  </head>
  <body>
    <div id="app"><!-- response.content --></div>
  </body>
</html>
```

The response contains serialized props and context plus the browser entry. The browser entry creates the same app and hydrates the configured `document.rootId`, which defaults to `app`. Keep Teleport anchor comments in `<head>` when hydration is enabled.

All request props and context are public when hydration is enabled. Do not send credentials, private tokens, or server-only records in those fields.

## Development proxy

A backend page usually has a different route origin from Vueforge. During development, proxy these requests to the Vueforge listener:

- `/@vite/client`
- `/@vueforge/client`
- Vue component and style module requests referenced by the response
- the Vite HMR WebSocket upgrade

The proxy must preserve the WebSocket upgrade. Keep Vueforge on a private interface and let the backend's development proxy be the browser-facing origin. If the backend is mounted under a path, configure `base` so returned asset URLs include that prefix. Use `origin` only when the browser should connect directly to Vueforge.

## Production assets

Run `vueforge build` before starting production. The response's stylesheet and browser entry URLs are root-relative, so the browser must be able to request those paths from the page origin. `tempDir` stores temporary build state and `build.outDir` selects the final output directory.

Choose one of these deployment arrangements:

1. Serve the `<build.outDir>/client` directory from the backend's static file handler.
2. Proxy asset requests from the backend origin to the Vueforge production server.
3. Put both services behind a reverse proxy that maps the same public asset paths to `<build.outDir>/client`.

Deploy `<build.outDir>/client` and `<build.outDir>/server` from the same build. Keep `build.outDir` identical for `build`, `serve`, and `render`.

## Request data and app factories

For a configured component or inline SFC, declare the props that the root component accepts. The request `context` is available through a declared `context` prop.

For a configured factory module path in `entry`, Vueforge calls `createApp(context, props)` for every render. Use the factory to create request-scoped router and store instances and to select the data that enters the app.

```ts
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp(context) {
  const app = createSSRApp(App)
  app.provide('requestContext', context)
  return app
}
```

The factory return value may be the app itself or an object containing `app`. Vueforge does not require a custom `defineApp` API.
