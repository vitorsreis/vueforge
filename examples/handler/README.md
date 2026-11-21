# Direct handler

This example declares the application factory directly in
`vueforge.config.ts`. A function assigned to `main` receives the complete
request context and returns a Vue SSR app. Vueforge treats this form like an
entry module without requiring a separate `src/entry.ts` file.

```ts
export default defineConfig({
  main(context: { name?: string }) {
    return createSSRApp({
      render: () => h('h1', `Hello ${String(context.name ?? 'Vueforge')}`),
    })
  },
})
```

## Run and render

```sh
npx vueforge serve --dev

curl -X POST http://127.0.0.1:9901/render \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada"}'
```

The response content is `<h1>Hello Ada</h1>`. The handler is invoked again for
the next request, which keeps request-specific values isolated.
