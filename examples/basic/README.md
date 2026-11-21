# Basic example

This project uses `src/App.vue` as its `main` component and reads `title` from
`context.props`.

```sh
npx vueforge serve --dev
```

Example requests are in [basic.http](./basic.http).

For production:

```sh
npx vueforge build
npx vueforge serve
```
