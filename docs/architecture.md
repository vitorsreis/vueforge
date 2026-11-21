# Architecture

Vueforge keeps one process alive and exposes a narrow rendering contract to an
external backend.

```text
backend
  -> HTTP, Unix socket, or stdio transport
  -> request parser and format negotiation
  -> configured main source or template catalog
  -> Vite SSR runner in development / built worker pool in production
  -> JSON fragments or a complete HTML document
```

The backend remains responsible for application routes, authentication, data
loading, and caching decisions.

## Source model

`main` resolves one component, inline SFC, entry module, directory, pattern,
descriptor, named catalog, or factory. The request can select only a name from
a configured catalog.

All application instances are created per render. The renderer does not retain
request props or context between calls. Entry modules must also create routers,
stores, and other mutable services per request.

## Runtime modes

Development creates a Vite environment in middleware mode. The SSR module
runner reloads changed modules and the client assets include the Vite and
Vueforge HMR clients.

Production loads the built SSR entry and serves the built client inventory. SSR
workers enforce concurrency, timeout, memory, request, and output limits. A
worker that exceeds its deadline is terminated and replaced.

## Response model

The renderer first collects Vue Teleport output for `head`, then asset tags, and
finally the SSR content. `parse5` converts top-level Teleport elements into
structured tags. Vue marker comments are removed from non-hydrated responses so
backends do not need to understand Vue's internal SSR markers.

`?format=json` returns `{ head, content }`. `?format=html` wraps the same
fragments with the configured document options.

## Public package boundary

The package root exports `defineConfig` and `createVueforgeApp`. Server adapters,
Vite plugins, workers, and transport internals remain private implementation
modules. The CLI is published as the `vueforge` executable.
