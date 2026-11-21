# Production SSR benchmark

From a VueForge source checkout with Node.js 26, run `npm ci` and then `npm run bench:render`.

The command compiles VueForge, copies `examples/basic/src/App.vue` to a fresh temporary project, builds it, and starts a production VueForge server on `127.0.0.1`. The benchmark sends JSON requests over HTTP keep-alive to `POST /render`. Each request supplies a distinct `title` prop and verifies the HTTP status, JSON content type, and rendered response.

The script runs two rounds, with one and two requests in flight, respectively. Each round sends 10 warmup requests and measures 100 requests. The report includes the Node.js version, OS, CPU, actual request count, elapsed time, throughput, and p50 and p95 latency (nearest rank). Latency runs from issuing a request through reading the complete response body. Round throughput also includes client-side validation.

Run it with other benchmark and test processes stopped for more comparable results. This workload measures one small component over loopback with the client and server sharing a machine. It excludes the build, startup, warmup, browser hydration, and asset requests. Results vary by machine and are a local baseline for this specific workload.

The script stops its server and removes `.vueforge/bench-render-*` for its run when it finishes or reports an error. After a forced interruption, the run's ignored temporary directory may remain.
