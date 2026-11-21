# Benchmarking

The benchmark measures a small production SSR workload over loopback. It is intended for comparing changes in the VueForge repository, not for predicting performance on another deployment.

## Run

From a checkout with dependencies installed, run the Node adapter benchmark:

```sh
npm run bench:render
```

The command builds the example project, starts production VueForge on loopback,
sends 10 warmup requests, and measures 5,000 requests at concurrency 1, 2, and 4. It reports throughput, p50 latency, p95 latency, runtime, and host information.

Run the same workload through the Bun adapter with:

```sh
bun benchmarks/render.mjs
```

Repeat each command several times. Local loopback results are noisy and should
be compared by median and spread, not by one run.

Each request uses HTTP keep-alive and validates the response. Build time, startup, browser hydration, asset downloads, and external network latency are outside the measurement.

Stop unrelated CPU-heavy processes when comparing runs. A forced interruption can leave an ignored directory under `.vueforge/bench-render-*`.
