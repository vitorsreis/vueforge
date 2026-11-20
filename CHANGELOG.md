# Changelog

## Unreleased

### Added

- Initial TypeScript package, contributor documentation, CI and GitHub Release workflow.
- CLI preview with development SSR, HMR, a production build and HTTP rendering with props.
- `vueforge render` renders a single request from stdin against a production build and writes the response to stdout.
- Render responses support optional browser hydration, stylesheet entries, and markup from Vue's `<Teleport to="head">`.

### Changed

- The default HTTP port is now 9901 (previously 4173).
- **Breaking:** `POST /render` now returns `{head, content}`. Read `content` in place of the former `html` field. `head` is HTML by default and can be requested as JSON with `format: "json"`.
