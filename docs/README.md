# Documentation

VueForge connects a Vue 3 application to a backend written in any language. Start with the guide that matches the work you are doing.

## Use VueForge

- [Quickstart](quickstart.md) goes from `src/App.vue` to a running renderer.
- [CLI and configuration](configuration.md) explains zero-config projects, source selection, both configuration files, Vite options, and the three CLI commands.
- [HTTP API](http-api.md) defines the request and response contracts for `/render`, `/`, and `/healthz`.
- [Backend integration](integration.md) shows how to compose `head` and `content`, enable hydration, proxy development assets, and deploy production assets.
- [Operations](operations.md) covers build and serve lifecycle, request isolation, limits, health checks, and troubleshooting.
- [Architecture](architecture.md) describes source selection, adapters, rendering, and the response contract.

## Maintain VueForge

- [Benchmarking](maintainers/benchmarking.md) describes the local production SSR benchmark.
- [Runtime support](maintainers/runtime-support.md) records the first-release runtime boundary.
- [Release process](maintainers/releasing.md) describes the npm and GitHub release workflow.
- [Contributing](../CONTRIBUTING.md) covers the development environment and quality checks.
- [Security policy](../SECURITY.md) explains the trust boundary and vulnerability reporting.
