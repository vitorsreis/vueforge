# Basic example

This project uses `src/App.vue` as its `source` and accepts a `title` prop.

```sh
npx vueforge serve --dev
curl --json '{"props":{"title":"Basic example"}}' http://127.0.0.1:9901/render
```

For production:

```sh
npx vueforge build
npx vueforge serve
```
