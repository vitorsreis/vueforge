# Named template catalog

This example shows Twig-like selection through the `template` query parameter.
Every `.vue` file under `src/pages` becomes a safe, build-time template
name.

```sh
npx vueforge serve --dev
```

Example requests are in [templates.http](./templates.http). The selected name
is sent through `?template=...` and the body remains application context.

For production:

```sh
npx vueforge build
npx vueforge serve
```
