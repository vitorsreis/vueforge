# Examples

Each directory is a small Vueforge project with a configuration, source files,
and HTTP requests that can be opened in an HTTP client.

- `basic` uses the default `.vue` component path.
- `factory` uses a request-scoped entry module and `createVueforgeApp`.
- `inline` uses an inline SFC in `main`.
- `component` imports a Vue component in the configuration.
- `templates` scans a directory as a named catalog.
- `pattern` scans files selected by a regular expression.
- `object` maps names to individual component and inline sources.
- `handler` declares the request-scoped app factory directly in the config.

Run an example from its directory:

```sh
npx vueforge serve --dev
```

The examples use the default `http://127.0.0.1:9901` listener.
