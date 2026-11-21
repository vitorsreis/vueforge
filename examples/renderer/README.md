# Framework-neutral renderer

This example uses `createVueforgeRenderer` directly and adapts its transport-neutral
response to a small Node.js HTTP server. Vueforge does not own the listener,
request parsing, or response serialization in this mode.

The server passes the request body as the Vueforge context. The `title` value is
read by `src/App.vue` through its component props.

## Run in development

Build the package, then start the example server from the repository root:

```sh
npm run build
node examples/renderer/server.mjs
```

Render JSON with the custom server:

```sh
curl -X POST 'http://127.0.0.1:9902/render?pretty' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Hello from a custom server"}}'
```

Request a complete HTML document:

```sh
curl -X POST 'http://127.0.0.1:9902/render?format=html' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"HTML response"}}'
```

## Run in production

Build the example project before starting the renderer in production mode:

```sh
npx vueforge build --root examples/renderer
VUEFORGE_MODE=production node examples/renderer/server.mjs
```

The public renderer API returns `{ status, headers, body }`. The example maps
those fields to Node's `ServerResponse`, so the same renderer can be embedded in
another HTTP framework, RPC server, worker, or process adapter.
