# Contributing

## Development environment

Vueforge requires Node.js 26 and npm.

```sh
npm ci
npm run check
```

Use `npm run format` to apply Prettier formatting. The project uses TypeScript, ESLint, Prettier, and Node's built-in test runner. Maintainer-specific workflows are documented in [docs/README.md](docs/README.md).

## Useful checks

| Command                        | Purpose                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `npm run check`                | Formatting, lint, type checking, build, and automated tests.                 |
| `npm run test:browser`         | Browser verification for SSR, hydration, styles, and HMR.                    |
| `npm run test:qualification`   | Install the packed package in a clean consumer project and exercise its CLI. |
| `npm run bench:render`         | Measure the production SSR example over loopback HTTP.                       |
| `npm audit --audit-level=high` | Check dependency advisories.                                                 |

Run the browser test only when a Chromium-based browser is available. Set `BROWSER_EXECUTABLE` to select its executable path.

## Project layout

```text
bin/vueforge       CLI entry point
src/index.ts       Public package API
src/config.ts      Project configuration loading and validation
src/build.ts       Production artifact generation
src/render/        Request validation and response assembly
src/server/        Development, production, and HTTP server runtime
src/vite/          Vue and Vite integration
tests/             Unit, integration, browser, and qualification tests
docs/              User and maintainer documentation
```

## Pull requests

Keep changes focused and include tests for behavior changes. Update the relevant user documentation when a public command, configuration option, request field, response field, or error behavior changes.

Use signed Conventional Commits, for example:

```text
fix: isolate request context
```

Before opening a pull request, run the checks that cover the changed code and describe the commands and results in the pull request. Keep generated files and local `.vueforge` artifacts out of commits.
