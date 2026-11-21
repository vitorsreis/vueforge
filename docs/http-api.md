# HTTP API

VueForge exposes an HTTP service in both development and production. The default origin is `http://127.0.0.1:9901`.

The backend owns application routes and the final HTML document. VueForge returns render fragments and never chooses a URL for the backend.

## `POST /render`

Send one JSON object with `Content-Type: application/json`. The request body is limited to 64 KiB. Every field is optional.

| Field     | Type                 | Default  | Description                                                                                      |
| --------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `props`   | object               | `{}`     | Props for the configured Vue source.                                                             |
| `context` | object               | omitted  | Per-request data for an `entry` factory or the root `context` prop of a file or template source. |
| `format`  | `"html"` or `"json"` | `"html"` | Representation of the `head` field in the response.                                              |
| `hydrate` | boolean              | `false`  | Include browser assets and serialized request data for hydration.                                |

Example request:

```json
{
  "props": { "title": "Hello" },
  "context": { "locale": "en" },
  "hydrate": true
}
```

The source is selected in `vueforge.config.ts`, never in the request body. File and template sources receive only props declared by the root component. An `entry` factory receives the complete `context` and `props` objects and decides what to use.

With `hydrate: true`, all submitted `props` and `context` values are public because VueForge embeds them in the page. Use the same values when the backend composes the server-rendered page and when the browser hydrates it.

### Response

A successful response has this shape:

```json
{
  "head": "",
  "content": "<h1>Hello</h1>"
}
```

`content` is the rendered HTML fragment. Insert it inside the element that will contain the Vue app, usually `<div id="app">`.

`head` contains stylesheet tags, the browser entry when hydration is enabled, and markup sent to Vue's native `<Teleport to="head">`. Insert it inside the document's `<head>`.

With `format: "html"`, `head` is an HTML string:

```json
{
  "head": "<link rel=\"stylesheet\" href=\"/assets/app.css\">",
  "content": "<h1>Hello</h1>"
}
```

With `format: "json"`, `head` is an ordered array. Generated entries have `tag`, `attrs`, and optional `content`. Teleported head content is represented as `{ "html": "..." }`.

```json
{
  "head": [
    {
      "tag": "link",
      "attrs": { "rel": "stylesheet", "href": "/assets/app.css" }
    },
    {
      "html": "<!--teleport start anchor--><title>Hello</title><!--teleport anchor-->"
    }
  ],
  "content": "<h1>Hello</h1>"
}
```

Treat generated head entries and content as output from the trusted Vue project. Escape or sanitize values before putting untrusted data into component props.

### Hydration

Use `hydrate: true` when the backend will serve a page that the browser must activate:

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- insert response.head here -->
  </head>
  <body>
    <div id="app"><!-- insert response.content here --></div>
  </body>
</html>
```

Development responses include `/@vite/client` and `/@vueforge/client`. Production responses include the hashed client entry from the build. Keep all returned head nodes in the document. Root-relative asset URLs must resolve from the page origin. A reverse proxy can forward development asset requests and the Vite WebSocket to VueForge.

### Calling from Python

```python
import json
from urllib.request import Request, urlopen

request = Request(
    "http://127.0.0.1:9901/render",
    data=json.dumps({"props": {"title": "Hello"}}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
with urlopen(request, timeout=5) as response:
    result = json.load(response)
    print(result["head"])
    print(result["content"])
```

## `GET /`

Returns the VueForge welcome information as JSON.

```json
{
  "message": "Welcome to VueForge!",
  "poweredBy": "Vitor Reis",
  "repo": "https://github.com/vitorsreis/vueforge",
  "version": "0.0.0"
}
```

The `version` value is read from the installed package.

## `GET /healthz`

Returns HTTP 200 with `Cache-Control: no-store`:

```json
{ "status": "ok" }
```

Use this route for a liveness check. Use `POST /render` to check application rendering.

## Errors

Error responses use this shape:

```json
{ "error": "A human-readable diagnostic" }
```

| Status | Meaning                                                                     |
| ------ | --------------------------------------------------------------------------- |
| `400`  | Invalid JSON, a non-object body, or invalid field types.                    |
| `413`  | The request exceeds 64 KiB.                                                 |
| `415`  | The request is not uncompressed UTF-8 JSON.                                 |
| `500`  | Vue SSR failed. The process log contains the component error.               |
| `503`  | All production render slots are busy. Retry after the `Retry-After` header. |
| `504`  | A production render exceeded its five-second deadline.                      |

Production limits concurrent renders to four slots and limits the transferred render result to 4 MiB. Development uses Vite's module runner and can still be blocked by synchronous project code.
