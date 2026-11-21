# Security policy

## Supported versions

Only the latest published version receives security fixes. The project has not published its first release yet.

## Reporting a vulnerability

Please report security vulnerabilities through the repository's private GitHub Security Advisory form. Include the affected version or commit, the smallest reproduction you can share privately, the expected impact, and any suggested mitigation.

Do not open a public issue for an unpatched vulnerability. The maintainer will acknowledge the report, investigate it, and coordinate a fix or disclosure timeline.

## Trust model

VueForge runs the project's Vue components, `vueforge.config.ts`, and Vite plugins with the permissions of the Node.js process. Run only trusted projects in the renderer process.

The HTTP server has no authentication. Bind it to `127.0.0.1` by default and place an authenticated backend or reverse proxy in front of it before exposing it to a network. Development mode also exposes Vite's development middleware and HMR endpoints.

The render request is limited to a 64 KiB JSON body. `props` and `context` are input data and must be validated by the backend before they are sent to Vue. With `hydrate: true`, the complete context and props are embedded in the page and are visible to the browser. Do not put secrets in them.

An `entry` factory decides which request data reaches the Vue app. Component sources receive only props declared by the root component. Treat generated `head` and `content` as trusted output from the configured project and escape or sanitize untrusted values before passing them into Vue.

Production rendering limits concurrent work, applies a deadline, bounds the transferred render output, and isolates each render worker. These limits do not replace operating-system permissions, process isolation, network controls, or resource quotas.
