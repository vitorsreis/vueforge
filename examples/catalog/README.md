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

curl -X POST 'http://127.0.0.1:9901/render?template=home' \
  -H 'Content-Type: application/json' \
  -d '{}'

curl -X POST 'http://127.0.0.1:9901/render?template=invoice' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"number":"A-42"}}'
```

The catalog is fixed when the project is loaded. A request can select a known
name, but it cannot load an arbitrary file or Vue source.
