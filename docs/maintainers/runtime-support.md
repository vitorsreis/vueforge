# Runtime support

The first release uses the Node.js adapter because it is the runtime used by
Vite's SSR server and gives the smallest supported production surface.

The Bun adapter prototype is preserved in the local `feature/bun-adapter`
branch. It is intentionally outside the first release so runtime support can be
reintroduced with its own compatibility and benchmark matrix.
