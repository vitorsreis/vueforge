# Direct factory

`main` can be a handler declared directly in `vueforge.config.ts`. Vueforge
calls it for every request with the complete context.

```sh
npx vueforge serve --dev
```

Request examples are in [handler.http](./handler.http).
