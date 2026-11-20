# HTTP API

The default origin is `http://127.0.0.1:9901`. Development and production expose the same routes.

## POST /render

Send `Content-Type: application/json` and a JSON object. The optional `props` object becomes the root component's props for this request. Send `{}` to use component defaults. The JSON body limit is 64 KiB (65,536 bytes).

```json
{ "props": { "title": "Hello" } }
```

With the component in the [quick start](../README.md), HTTP 200 returns:

```json
{ "html": "<h1>Hello</h1>" }
```

The response contains a fragment suitable for embedding in a backend-generated page. The caller owns the surrounding document, asset loading and any hydration of that fragment. The current request contract uses only `props`.

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
    print(json.load(response)["html"])
```

### Handling errors

Render errors use a JSON body with an `error` string. Use the HTTP status to choose how to handle a failure. The message is for the person diagnosing it.

| Status | Cause                                                 | Action                                                                                |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 400    | Malformed JSON, a non-object body, or invalid `props` | Send a JSON object with the JSON content type. If present, `props` must be an object. |
| 413    | Body exceeds 64 KiB                                   | Reduce the data passed to the component.                                              |
| 415    | Unsupported charset or content encoding               | Send uncompressed UTF-8 JSON.                                                         |
| 500    | SSR threw while handling the render                   | Inspect the VueForge process log for the original exception.                          |

For example, sending `{"props":[]}` returns HTTP 400 and:

```json
{
  "error": "\"props\" must be a JSON object, for example {\"props\":{\"title\":\"Hello\"}}."
}
```

## GET /

Returns an HTML document rendered with the component's default props and a module script that hydrates the page. In development Vite also injects its browser client for HMR.

## GET /healthz

Returns HTTP 200, `Cache-Control: no-store` and `{"status":"ok"}`. This liveness probe confirms the server answers HTTP after initialization. To check a specific component's render behavior, call `POST /render` with representative props.
