# Operations

## Development

Start development from the project root:

```sh
npx vueforge serve --dev
```

Vite stays alive for the process lifetime. Component edits are picked up by later SSR requests. Hydrated pages use Vite HMR. Keep development mode private because it serves Vite middleware and has no authentication.

When a module fails during HMR, Vueforge displays its own error overlay with the Vite message, file location, source frame, and stack trace. A failed `POST /render` can return the same diagnostic information as an HTML page or JSON by using the options described in [HTTP API](http-api.md#development-diagnostics).

## Production lifecycle

Build once, then run the server from the same project root and `build.outDir`:

```sh
npx vueforge build
npx vueforge serve
```

The build uses `.vueforge` for temporary staging and creates client and server artifacts under `build.outDir`, which defaults to `dist`. A production process loads the server entry at startup. Restart it after a new build.

`vueforge render` is the one-shot production path for jobs, tests, and backends that prefer standard input:

```sh
printf '%s\n' '{"props":{"title":"Hello"}}' | npx vueforge render
```

## Health and availability

Use `GET /healthz` for a liveness probe. It returns `{"status":"ok"}` with `Cache-Control: no-store` after the HTTP server has initialized.

Use `POST /render` for an application-level check. A successful health check does not prove that the build artifacts or Vue template or entry render successfully.

## Request isolation and caching

Each render creates a new Vue app. Vite modules and compiled production code are reused, so request-specific state must stay inside the app or its factory. Do not keep request data in module-level mutable values.

Vueforge does not cache rendered HTML. Add caching in the backend only when the document is safe to reuse. Include every render input in the cache key.

## Transports

TCP is the default persistent transport. Use `--unix <path>` or `server.unix` in
the configuration for a Unix socket. Use `--stdio` for newline-delimited JSON on
the CLI. Stdio cannot be combined with a Unix socket. Configure
`server.ssl: { cert, key, ca? }` for TLS on TCP.

## Limits

- JSON request body: 64 KiB
- Production concurrency: four render slots
- Production deadline: five seconds
- Production transferred render output: 4 MiB

A busy production server returns `503` with `Retry-After: 1`. A render that reaches the deadline returns `504`. Development renders use Vite's runner and can still be blocked by synchronous project code. Override these values with `limits` or command-line limit options.

## Troubleshooting

### Build artifacts are missing

Run `vueforge build` and confirm that `build.outDir` is the same for build and serve. Deploy both `<build.outDir>/client` and `<build.outDir>/server` from that build.

### The browser cannot load styles or scripts

Check that the asset URLs returned in `head` resolve from the page origin. In development, proxy Vite module requests and the HMR WebSocket. In production, serve or proxy `<build.outDir>/client`.

### Hydration warnings appear

Use the same props and context for SSR and hydration. Keep the returned head nodes and Teleport anchor comments in the document. Avoid reading time, random values, or browser-only state during the initial render.

### The request is rejected

Check the JSON content type, the 64 KiB limit, and the field types documented in [HTTP API](http-api.md). `props` and `context` must be JSON objects.
