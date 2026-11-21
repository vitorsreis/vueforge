# Changelog

## Unreleased

### Added

- Initial TypeScript package, contributor documentation, CI and GitHub Release workflow.
- CLI preview with development SSR, HMR, a production build and HTTP rendering with props.
- `vueforge render` renders a single request from stdin against a production build and writes the response to stdout.
- Render responses include `head` and `content`, with HTML or structured JSON for the head, optional browser hydration, stylesheet entries, and markup from Vue's `<Teleport to="head">`.
- Project configuration supports a root Vue file, an inline SFC or an app factory. HTTP and CLI requests can supply a public JSON context to the selected source.
