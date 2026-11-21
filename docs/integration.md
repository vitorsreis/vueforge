# Backend integration

VueForge is a renderer service. Your backend keeps ownership of routes, authentication, data loading, and the final HTML document.

## Render a page

Send the data required by the configured Vue source to `POST /render`:

```json
{
  "props": { "title": "Orders" },
  "context": { "locale": "en-US" }
}
```

Use `format: "html"` when the backend can insert the returned `head` string directly. Use `format: "json"` when the backend has its own HTML element builder.

The caller composes the response document:

```text
backend route
  -> POST /render
  -> put response.head inside <head>
  -> put response.content inside <div id="app">
  -> return the document
```

VueForge does not add a document wrapper and does not know which backend URL produced the request.

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

The response contains serialized props and context plus the browser entry. The browser entry creates the same app and hydrates `#app`.

All request props and context are public when hydration is enabled. Do not send credentials, private tokens, or server-only records in those fields.

## Development proxy

A backend page usually has a different route origin from VueForge. During development, proxy these requests to the VueForge listener:

- `/@vite/client`
- `/@vueforge/client`
- Vue component and style module requests referenced by the response
- the Vite HMR WebSocket upgrade

The proxy must preserve the WebSocket upgrade. Keep VueForge on a private interface and let the backend's development proxy be the browser-facing origin.

## Production assets

Run `vueforge build` before starting production. The response's stylesheet and browser entry URLs are root-relative, so the browser must be able to request those paths from the page origin.

Choose one of these deployment arrangements:

1. Serve the `<tempDir>/client` directory from the backend's static file handler.
2. Proxy asset requests from the backend origin to the VueForge production server.
3. Put both services behind a reverse proxy that maps the same public asset paths to `<tempDir>/client`.

Deploy `<tempDir>/client` and `<tempDir>/server` from the same build. Keep `tempDir` identical for `build`, `serve`, and `render`.

## Request data and app factories

For a configured file or template, declare the props that the root component accepts. The request `context` is available through a declared `context` prop.

For a configured `entry`, VueForge calls `createApp(context, props)` for every render. Use the factory to create request-scoped router and store instances and to select the data that enters the app.

```ts
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp(context) {
  const app = createSSRApp(App)
  app.provide('requestContext', context)
  return app
}
```

The factory return value may be the app itself or an object containing `app`. VueForge does not require a custom `defineApp` API.
