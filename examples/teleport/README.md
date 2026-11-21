# Head Teleport

This example uses Vue's native `<Teleport>` component to send document
metadata to the `head` target. Vueforge removes the Teleport markers and
returns the resulting elements as structured `head` entries in JSON mode.

## Run and render

```sh
npx vueforge serve --dev
```

```sh
curl -X POST 'http://127.0.0.1:9901/render?pretty=1' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Orders","description":"Order list"}}'
```

The response contains entries similar to:

```json
{
  "head": [
    {
      "tag": "title",
      "attrs": {},
      "content": "Orders"
    },
    {
      "tag": "meta",
      "attrs": {
        "name": "description",
        "content": "Order list"
      }
    }
  ],
  "content": "<main><h1>Orders</h1></main>"
}
```

Use `?format=html` when Vueforge should assemble the complete document. The
teleported tags are placed inside the configured document head.

```sh
curl -X POST 'http://127.0.0.1:9901/render?format=html' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Orders","description":"Order list"}}'
```
