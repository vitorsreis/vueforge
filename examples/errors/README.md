# Development errors

This example intentionally exposes a request-controlled render failure. It
shows how Vueforge returns normalized diagnostics in development and keeps
component details generic in production.

## Run in development

```sh
npx vueforge serve --dev
```

Render successfully first:

```sh
curl -X POST 'http://127.0.0.1:9901/render' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"fail":false}}'
```

Trigger the failure and request JSON diagnostics:

```sh
curl -X POST 'http://127.0.0.1:9901/render?error=json' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"fail":true}}'
```

The response has status `500` and contains the normalized error location:

```json
{
  "error": "Example render failure",
  "details": {
    "name": "Error",
    "message": "Example render failure",
    "file": "src/App.vue",
    "line": 7,
    "stack": "Error: Example render failure\\n    at ..."
  }
}
```

Request the browser-oriented diagnostic page instead:

```sh
curl -X POST 'http://127.0.0.1:9901/render?error=html' \
  -H 'Accept: text/html' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"fail":true}}'
```

The HTML response is a complete `Vueforge SSR error` document with the
message, source location, source frame when available, and stack trace. The
development HMR client uses the same diagnostic information in its overlay.

## Production behavior

Build and start the production server:

```sh
npx vueforge build
npx vueforge serve
```

The same failing request returns a generic JSON error. Vueforge keeps the
component details in the server log instead of exposing source and stack data.
