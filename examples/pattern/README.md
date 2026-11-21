# Pattern catalog

When `main` is a regular expression, Vueforge scans `.vue` files below `src`
and creates a named catalog from the matching paths. This example selects
files ending in `.page.vue`.

The file `src/home.page.vue` becomes the request template name
`home.page`. The `template` query parameter chooses the file to render.

## Run and render

```sh
npx vueforge serve --dev

curl -X POST 'http://127.0.0.1:9901/render?template=home.page' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Home"}}'
```

The regular expression and the selected files are resolved by Vueforge before
requests are handled. Request data stays in the context body.
