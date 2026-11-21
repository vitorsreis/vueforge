# Basic component

This is the smallest Vueforge project. It relies on the default `main` value,
`src/App.vue`, so the configuration file is optional. The component reads its
`title` from `context.props`.

## Run in development

Start the persistent server with Vite HMR:

```sh
npx vueforge serve --dev
```

Render JSON through the default endpoint:

```sh
curl -X POST http://127.0.0.1:9901/render \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Hello World"}}'
```

The request body is the application context. Vueforge passes it to the
configured application and returns `{ "head": [], "content": "..." }` in
JSON mode. Development responses can also include the Vite and Vueforge
client tags in `head`.

Ask for a complete HTML document with either content negotiation or the
`format` query parameter:

```sh
curl -X POST 'http://127.0.0.1:9901/render?format=html' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Hello World"}}'
```

Enable the client hydration payload when the returned document will be used
in a browser:

```sh
curl -X POST 'http://127.0.0.1:9901/render?format=html&hydrate' \
  -H 'Content-Type: application/json' \
  -d '{"props":{"title":"Hello World"}}'
```

## Build and run in production

```sh
npx vueforge build
npx vueforge serve
```

Production mode reads the generated artifacts and does not run the Vite
development middleware.
