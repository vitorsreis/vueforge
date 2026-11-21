# HTTP API

The default origin is `http://127.0.0.1:9901`. Development and production expose the same routes.

## POST /render

Send a JSON object with `Content-Type: application/json`. The body limit is 64 KiB (65,536 bytes). All request fields are optional.

| Field     | Type                 | Default  | Meaning                                                            |
| --------- | -------------------- | -------- | ------------------------------------------------------------------ |
| `props`   | JSON object          | `{}`     | Props passed to the root component.                                |
| `context` | JSON object          | —        | Optional rendering context passed to the configured source.        |
| `format`  | `"html"` or `"json"` | `"html"` | Controls how the `head` field is represented in the JSON response. |
| `hydrate` | Boolean              | `false`  | Includes the browser entry and serialized props for hydration.     |

Send `{}` to render the component with its prop defaults.

```json
{ "props": { "title": "Hello" } }
```

The configured source is selected in project configuration, not in the request body. `context` is passed as the first argument to an `entry` factory, or as the root `context` prop for `file` and `template` sources (taking precedence over `props.context`). The CLI accepts the same request fields through stdin. When `hydrate` is `true`, the complete context is serialized to the page and is public; use the same context for server rendering and hydration.

With the component in the [quick start](../README.md), HTTP 200 returns the following JSON.

```json
{ "head": "", "content": "<h1>Hello</h1>" }
```

`content` is the rendered HTML fragment. The caller owns the document and wraps that fragment in `<div id="app">` when using hydration. `head` contains stylesheet entries and any HTML sent to `head` by Vue's native `<Teleport to="head">`, even with hydration disabled. Place it inside the document's `<head>`.

With `format: "html"`, `head` is directly embeddable markup. With `format: "json"`, it is an array in document order. VueForge-generated entries have a `tag` string and an `attrs` object, plus a `content` string when they have inner content. Teleported entries have the shape `{ "html": "..." }`. Treat those entries as raw HTML from trusted project components. Serialize the structured entries as their indicated HTML elements if you use them in a page.

### Hydrating a backend page

Send `"hydrate": true` and insert the returned head and content into your document. Use this layout with the default HTML format.

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- Insert head here -->
  </head>
  <body>
    <div id="app"><!-- Insert content here --></div>
  </body>
</html>
```

Keep the returned head nodes in the document when the modules execute. VueForge embeds request props as escaped JSON in `<script type="application/json" id="vueforge-props">`. The browser can read those props, so pass values that are safe to expose to the page. Development includes the `/@vite/client` and `/@vueforge/client` modules. Production uses a hashed client entry from the build.

Root-relative asset URLs resolve against the page's origin. If VueForge listens on a separate port in production, serve the build's client assets from the backend origin or forward asset requests to VueForge. In development, a proxy can keep your backend page routes local and forward other GET requests and WebSocket upgrades to VueForge. The upgrades carry Vite HMR on the same origin.

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

### Handling errors

Render errors use a JSON body with an `error` string. Use the HTTP status to choose how to handle a failure. The message is for the person diagnosing it.

| Status | Cause                                                        | Action                                                                       |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 400    | Malformed JSON, a non-object body, or invalid request fields | Send a JSON object with the JSON content type and use the field types above. |
| 413    | Body exceeds 64 KiB                                          | Reduce the data passed to the component.                                     |
| 415    | Unsupported charset or content encoding                      | Send uncompressed UTF-8 JSON.                                                |
| 500    | SSR threw while handling the render                          | Inspect the VueForge process log for the original exception.                 |

For example, sending `{"props":[]}` returns HTTP 400 and:

```json
{
  "error": "\"props\" must be a JSON object, for example {\"props\":{\"title\":\"Hello\"}}."
}
```

## GET /

Returns HTTP 200 with the plain text `Welcome to VueForge!`.

## GET /healthz

Returns HTTP 200, `Cache-Control: no-store` and `{"status":"ok"}`. This liveness probe confirms the server answers HTTP after initialization. To check a specific component's render behavior, call `POST /render` with representative props.
