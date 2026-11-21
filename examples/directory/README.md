# Directory catalog

When `main` is a directory, Vueforge scans the directory recursively and
creates a named catalog from its `.vue` files. This example uses
`main: 'src/pages'` and exposes `home` and `invoice` from the files below
that directory.

Directory catalogs are useful for Twig-like selection while keeping the list
of renderable files explicit and build-time controlled. The request chooses a
catalog entry with the `template` query parameter.

## Run and render

```sh
npx vueforge serve --dev
```

```sh
curl -X POST 'http://127.0.0.1:9901/render?template=home&format=json&pretty=1' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Welcome to the catalog"}}'
```

```sh
curl -X POST 'http://127.0.0.1:9901/render?template=invoice&format=html' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"number":"A-42","total":"R$ 129,90"}}'
```

The `template` query value is separate from the request context. The JSON body
can contain any application-specific data needed by the selected component.

## Unknown template

Requesting a name that was not found while scanning `src/pages` is rejected
before Vue SSR runs:

```sh
curl -i -X POST 'http://127.0.0.1:9901/render?template=missing&pretty=1' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

The server returns `400` with a JSON error:

```json
{
  "error": "Unknown template \"missing\"."
}
```

## Production

```sh
npx vueforge build
npx vueforge serve
```
