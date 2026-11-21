# Framework-neutral renderer

This example uses `createVueforgeRenderer` directly from a Node.js script.
Vueforge owns only the SSR pipeline, so the host process decides how to receive
input and how to serialize the returned response.

The script passes a request context to the renderer. The `title` value is read
by `src/App.vue` through its component props.

## Run in development

Build the package, then run the example from the repository root:

```sh
npm run build
node examples/renderer/render.mjs "Hello from a script"
```

The script prints the transport-neutral JSON body:

```json
{
  "head": [
    { "tag": "script", "attrs": { "type": "module", "src": "/@vite/client" } },
    {
      "tag": "script",
      "attrs": { "type": "module", "src": "/@vueforge/client" }
    }
  ],
  "content": "<main><h1>Hello from a script</h1>..."
}
```

## Run in production

Build the example project before starting the renderer in production mode:

```sh
npx vueforge build --root examples/renderer
VUEFORGE_MODE=production node examples/renderer/render.mjs "Production render"
```

The public renderer API returns `{ status, headers, body }`. A host can map
those fields to an HTTP framework, RPC server, worker, or process adapter.
