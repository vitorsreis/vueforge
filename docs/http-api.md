# HTTP API

`vueforge serve` exposes a long-lived renderer on `http://127.0.0.1:9901` by
default. The backend owns routing, authentication, data loading, and the final
HTML document.

## `POST /render`

Send one UTF-8 JSON object with `Content-Type: application/json`.

| Field/query | Type             | Description                                                        |
| ----------- | ---------------- | ------------------------------------------------------------------ |
| body        | object           | Complete request context passed to the Vue app.                    |
| `template`  | query string     | Named template selected from a configured catalog.                 |
| `format`    | `json` or `html` | Response representation. Defaults to JSON or `Accept` negotiation. |
| `hydrate`   | query boolean    | Includes browser assets and public hydration data.                 |

```sh
curl --request POST \
  --header 'Content-Type: application/json' \
  --data '{"props":{"title":"Hello"}}' \
  http://127.0.0.1:9901/render
```

Catalog example:

```sh
curl --request POST \
  --header 'Content-Type: application/json' \
  --data '{"props":{"number":"A-42"}}' \
  'http://127.0.0.1:9901/render?template=invoice'
```

The request body is bounded by `limits.maxRequestBytes`. `template` is required
when `catalog` is configured and must match a configured name.

## JSON response

```json
{
  "head": [],
  "content": "<h1>Hello</h1>"
}
```

`content` is the SSR fragment. `head` is an ordered array of structured tags.
Teleport output targeting `head` is parsed into `{tag, attrs, content}` entries.
Vue SSR marker comments are omitted from both `head` and `content` unless
`hydrate` is enabled. Raw entries are reserved for markup that cannot be
represented as one top-level tag.

Development responses add `/@vite/client` and `/@vueforge/client` to `head`.
Production responses add the built client entry when hydration is enabled.

Responses are compact by default. Add `?pretty=1` or `?pretty=true` to format a
JSON response for humans. The query applies to every HTTP route that returns
JSON. HTML responses are never pretty-printed by this option.

## HTML response

Request a complete document with the body field or `Accept: text/html`.

```sh
curl --request POST \
  --header 'Accept: text/html' \
  --header 'Content-Type: application/json' \
  --data '{"props":{"title":"Hello"}}' \
  http://127.0.0.1:9901/render
```

The configured `document` options control the doctype, `<html>` attributes,
`<head>`, `<body>`, and Vue root element.

## Format negotiation

The server chooses the format in this order:

1. `format` in the query string.
2. The highest-quality supported media type in `Accept`.
3. `format` from `vueforge.config.ts`.
4. JSON.

Supported media types are `application/json` and `text/html`. An `Accept` header
that excludes both returns `406`.

## Hydration

Use `?hydrate` when the backend inserts the response into a browser page. The
complete request context and selected template name are serialized into one
`<script id="__VUEFORGE__">` tag and are therefore public to the browser. Keep the returned head entries in
`<head>` and the content inside the configured root element.

## Other routes

`GET /` returns package information.

```json
{
  "message": "Welcome to Vueforge!",
  "poweredBy": "Vitor Reis",
  "repo": "https://github.com/vitorsreis/vueforge",
  "version": "0.0.0"
}
```

`GET /healthz` returns `{ "status": "ok" }` with `Cache-Control: no-store`.

## Errors

Errors use `{ "error": "..." }`. Development render failures also include a
normalized `details` object with the file, line, column, source frame, plugin,
and stack. Request `?error=html` or `Accept: text/html` for the development
diagnostic page. Production responses keep component details in the server log.

### Development diagnostics

To reproduce a component error, temporarily add a failing expression to the
configured Vue source:

```vue
<script setup>
throw new Error('Example render failure')
</script>
```

Request JSON diagnostics when the backend wants to display or log the error:

```sh
curl --request POST \
  --header 'Content-Type: application/json' \
  --data '{}' \
  'http://127.0.0.1:9901/render?error=json'
```

Development responses have status `500` and include normalized source details:

```json
{
  "error": "Example render failure",
  "details": {
    "name": "Error",
    "message": "Example render failure",
    "file": "src/App.vue",
    "line": 2,
    "column": 7,
    "plugin": "vite:vue",
    "frame": "...source frame from Vite...",
    "source": "...nearby source lines...",
    "stack": "Error: Example render failure\\n    at ..."
  }
}
```

Request the browser-oriented diagnostic page when the backend wants to return
the complete error document:

```sh
curl --request POST \
  --header 'Accept: text/html' \
  --header 'Content-Type: application/json' \
  --data '{}' \
  'http://127.0.0.1:9901/render?error=html'
```

The HTML response is a complete document titled `Vueforge SSR error`. It shows
the message, file location, Vite frame, source excerpt, and stack trace. The
development client uses the same diagnostic fields in its HMR error overlay.

| Status | Meaning                                                  |
| ------ | -------------------------------------------------------- |
| `400`  | Invalid JSON or request fields.                          |
| `406`  | No supported response format is accepted.                |
| `413`  | Request or rendered output exceeds its configured limit. |
| `415`  | Unsupported content type, encoding, or charset.          |
| `500`  | Rendering failed.                                        |
| `503`  | All render slots are busy.                               |
| `504`  | Rendering exceeded its timeout.                          |
