# Architecture

VueForge is a process-local Vue SSR renderer. It keeps routing and final-page
composition in the backend while providing a stable render contract.

```text
backend route
    -> HTTP TCP / Unix socket, or CLI stdio
    -> request validation and format negotiation
    -> Vue source resolver and Vite module runner
    -> SSR render
    -> JSON envelope or configured HTML document
```

## Source and rendering

The project root resolves the Vue source, configuration, Vite modules, and
artifacts. The source is `src/App.vue` by default. The single configured
`source` is classified internally as a component, inline SFC, or factory module.
A factory module creates a fresh Vue app for each render and may provide
request-scoped router or store state.

Development uses Vite's module runner and HMR. Production loads the server
artifact produced by `vueforge build` and reuses compiled modules while keeping
each render's app and request data isolated.

## Adapters and contract

The render handler validates `props`, `context`, `format`, and `hydrate`, applies
limits, and maps failures to status codes. HTTP adapters expose `/render`, `/`,
and `/healthz`. The stdio adapter reads newline-delimited JSON and writes one
JSON response per input line. Bun development places a Bun HTTP and WebSocket
proxy in front of an internal Vite server so HMR uses the public origin.

Format selection uses explicit request format first, then `Accept` quality,
then configured format, and finally JSON. JSON returns `head` entries and a
content fragment. HTML uses `document` options to return a complete document.

Hydration serializes request values and browser assets into head entries. Values
included in a hydrated request are public to the browser.
