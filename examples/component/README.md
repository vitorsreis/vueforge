# Imported component

This example imports `src/Card.vue` into `vueforge.config.ts` and assigns the
component directly to `main`. It is useful when the host application already
has a component module and does not need an entry file.

```ts
import { defineConfig } from '@vitorsreis/vueforge'
import Card from './src/Card.vue'

export default defineConfig({
  main: Card,
})
```

## Run and render

```sh
npx vueforge serve --dev

curl -X POST 'http://127.0.0.1:9901/render?format=html' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Orders"}}'
```

The response contains the rendered `<article>` from `Card.vue`. The component
receives `context.props` as its Vue props.

Build artifacts before starting the production server:

```sh
npx vueforge build
npx vueforge serve
```
