# Factory example

This example uses `entry: 'src/entry.ts'`. Vueforge calls the factory for each
render, so request context can be provided without shared module state.

```sh
npx vueforge serve --dev
```

Example requests are in [factory.http](./factory.http).

For production:

```sh
npx vueforge build
npx vueforge serve
```
