# Changelog

## [1.0.0] - 2026-11-21

First stable release of Vueforge, a Vue 3 SSR renderer for backends written in
any language.

### Added

- Vite-powered development SSR with browser HMR and development diagnostics.
- Component, entry, direct factory, directory, pattern, and named catalog sources.
- JSON and HTML rendering through HTTP, Unix socket, and JSONL standard input transports.
- Production builds with bounded, isolated rendering workers and browser assets.
- Framework-neutral renderer API for custom servers and adapters.
- CLI commands for building projects, serving development or production renders, and processing one-shot requests.

### Security

- Request, concurrency, timeout, and output limits for production rendering.
- Generic production error responses that keep source diagnostics out of the HTTP body.
