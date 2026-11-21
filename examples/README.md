# Examples

Each directory is a small Vueforge project with its own configuration and
source files. The README in each example explains the selected `main` source,
the request context, and commands that can be copied into a terminal.

- [`basic`](./basic/) uses the default `src/App.vue` component.
- [`component`](./component/) imports a Vue component into `main`.
- [`entry`](./entry/) loads an entry module and creates an app per request.
- [`handler`](./handler/) declares the request-scoped factory directly in the config.
- [`inline`](./inline/) compiles an inline single-file component.
- [`directory`](./directory/) scans every `.vue` file in a directory.
- [`pattern`](./pattern/) scans files selected by a regular expression.
- [`catalog`](./catalog/) defines a named catalog of components and inline SFCs.

Run an example from its directory:

```sh
npx vueforge serve --dev
```

The examples use the default `http://127.0.0.1:9901` listener.
