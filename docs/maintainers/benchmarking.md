# Benchmarking

The benchmark measures a small production SSR workload over loopback. It is intended for comparing changes in the VueForge repository, not for predicting performance on another deployment.

## Run

From a checkout with Node.js 26 and dependencies installed:

```sh
npm run bench:render
```

The command builds the example project, starts production VueForge on loopback, sends 10 warmup requests, and measures 100 requests at concurrency 1 and 2. It reports throughput, p50 latency, p95 latency, Node.js version, and host information.

Each request uses HTTP keep-alive and validates the response. Build time, startup, browser hydration, asset downloads, and external network latency are outside the measurement.

Stop unrelated CPU-heavy processes when comparing runs. A forced interruption can leave an ignored directory under `.vueforge/bench-render-*`.
