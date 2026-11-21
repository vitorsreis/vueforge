# Named template catalog

This example shows Twig-like selection through the request `template` field.
Every `.vue` file under `src/templates` becomes a safe, build-time template
name.

```sh
npx vueforge serve --dev
```

Request `invoice.http` with an HTTP client that supports `.http` files.

For production:

```sh
npx vueforge build
npx vueforge serve
```
