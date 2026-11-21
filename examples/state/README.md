# Render state

The request context can carry a `state` value through SSR. An entry factory
can read that value, update it during rendering, and return the updated state
in the JSON response. This is useful when the backend needs the renderer to
report request-scoped values produced while creating the Vue app.

## Run and render

```sh
npx vueforge serve --dev
```

Send an initial state value in the request body:

```sh
curl -X POST 'http://127.0.0.1:9901/render?pretty=1' \
  -H 'Content-Type: application/json' \
  -d '{"state":{"count":4}}'
```

The entry increments `state.count` before creating the app. The response
contains both the rendered content and the updated state:

```json
{
  "head": [],
  "content": "<p>Render count: 5</p>",
  "state": {
    "count": 5
  }
}
```

The state is request-scoped. A later request starts from the state sent in its
own body and does not reuse the previous render's value.

## Hydration

When `?hydrate` is enabled, the complete context, including the updated state,
is serialized in the `__VUEFORGE__` script payload. Treat it as public data
because the browser can read it.
