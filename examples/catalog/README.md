# Named component catalog

An object-valued `main` defines a fixed catalog of renderable names. Each
catalog entry can be a `.vue` file, an imported Vue component, or an inline
SFC. The request selects one name with the `template` query parameter.

The example defines these names:

- `home` points to `src/home.vue`.
- `invoice` points to the imported `src/invoice.vue` component.
- `inline` contains an inline SFC.

## Run and render

```sh
npx vueforge serve --dev
```

```sh
curl -X POST 'http://127.0.0.1:9901/render?template=home&pretty=1' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

```sh
curl -X POST 'http://127.0.0.1:9901/render?template=invoice&pretty=1' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"number":"A-42"}}'
```

The catalog is fixed when the project is loaded. A request can select a known
name, but it cannot load an arbitrary file or Vue source.

## Unknown template

Requesting a name that is not in the catalog is rejected before Vue SSR runs:

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
