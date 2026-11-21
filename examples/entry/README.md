# Entry module

This example selects `src/entry.ts` as `main`. The entry module exports a
request-scoped factory created with `createVueforgeApp`. Vueforge calls it for
each render, so the context can be used to create fresh app state, routers, or
stores without sharing mutable request data between renders.

The entry module receives the complete request body:

```ts
export default createVueforgeApp((context) => {
  return createSSRApp(App, context.props)
})
```

## Run and render

```sh
npx vueforge serve --dev

curl -X POST http://127.0.0.1:9901/render \
  -H 'Content-Type: application/json' \
  -d '{"props":{"name":"Ada"}}'
```

The example currently reads `context.props.name` through the app props. Add
other application-specific values to the same JSON object when extending the
entry module.

## Production

```sh
npx vueforge build
npx vueforge serve
```
