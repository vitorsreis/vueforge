# Contributing

Install Node.js 26 LTS and run `npm ci`. Run `npm run check` before opening a pull request. Use `npm run format` to apply formatting.

Build and type checking use the TypeScript 7 compiler. ESLint uses the TypeScript 6 API supported by typescript-eslint.

`npm run check` runs formatting, lint, type checks, unit tests and integration tests. Use `npm run test:qualification` to pack the release and test it from a fresh consumer installation. Use `npm run test:browser` to exercise SSR, hydration and HMR in Chrome. For throughput and latency measurements, see [Production SSR benchmark](docs/benchmarks.md).

To try the bundled app from such a checkout:

```sh
npm run build
cd examples/basic
node ../../bin/vueforge serve --dev
```

From that same directory, stop the dev server and run `node ../../bin/vueforge build`, followed by `node ../../bin/vueforge serve`, to exercise the production build.

Open focused pull requests against `main` and describe how you verified the change. Use signed Conventional Commits, such as `fix: isolate request context`. Add an entry to `CHANGELOG.md` for user-facing changes.
