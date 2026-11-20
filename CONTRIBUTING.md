# Contributing

Install Node.js 26 LTS and run `npm ci`. Run `npm run check` before opening a pull request. Use `npm run format` to apply formatting.

The current development dependency set pairs TypeScript 7 with a version of `typescript-eslint` that requires TypeScript below 6.1. This blocks a clean `npm ci` and the lint step. A checkout with dependencies already installed can run `npm test` to build the CLI and exercise development and production over HTTP.

To try the bundled app from such a checkout:

```sh
npm run build
cd examples/basic
node ../../bin/vueforge serve --dev
```

From that same directory, stop the dev server and run `node ../../bin/vueforge build`, followed by `node ../../bin/vueforge serve`, to exercise the production build.

Open focused pull requests against `main` and describe how you verified the change. Use signed Conventional Commits, such as `fix: isolate request context`. Add an entry to `CHANGELOG.md` for user-facing changes.
