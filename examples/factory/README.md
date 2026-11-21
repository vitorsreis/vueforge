# Factory example

This example uses `source: 'src/entry.ts'`. VueForge calls the factory for each
render, so request context can be provided without shared module state.

```sh
npx vueforge serve --dev
curl --json '{"context":{"name":"Ada"}}' http://127.0.0.1:9901/render
```
