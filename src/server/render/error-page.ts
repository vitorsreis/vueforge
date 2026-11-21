import { errorLocation, type RenderErrorDetails } from './error.js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function block(value: string | undefined): string {
  return value ? `<pre>${escapeHtml(value)}</pre>` : ''
}

/** Renders the development-only error page returned for HTML requests. */
export function renderErrorPage(error: RenderErrorDetails): string {
  const location = errorLocation(error)
  const title = escapeHtml(error.message)
  const details = [
    error.file
      ? `<div class="meta">${escapeHtml(location ?? error.file)}</div>`
      : '',
    error.plugin
      ? `<div class="meta">Plugin ${escapeHtml(error.plugin)}</div>`
      : '',
    error.frame
      ? `<section><h2>Vite frame</h2>${block(error.frame)}</section>`
      : '',
    error.source
      ? `<section><h2>Source</h2>${block(error.source)}</section>`
      : '',
    error.stack
      ? `<section><h2>Stack trace</h2>${block(error.stack)}</section>`
      : '',
  ].join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vueforge SSR error</title>
<style>
:root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; background: #171717; color: #f5f5f5; }
body { margin: 0; min-height: 100vh; background: radial-gradient(circle at top right, #3b1717, #171717 48%); }
main { box-sizing: border-box; width: min(1120px, 100%); margin: 0 auto; padding: 48px 24px 80px; }
.brand { color: #fca5a5; font-size: 13px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
h1 { margin: 12px 0 8px; color: #fecaca; font-size: clamp(28px, 5vw, 52px); line-height: 1.05; overflow-wrap: anywhere; }
h2 { margin: 32px 0 12px; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: #fda4af; }
.meta { color: #d4d4d4; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 14px; overflow-wrap: anywhere; }
pre { overflow: auto; margin: 0; padding: 18px; border: 1px solid #4b2020; border-radius: 10px; background: #0f0f0f; color: #e5e5e5; font: 13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre; }
section { margin-top: 26px; }
</style>
</head>
<body><main>
<div class="brand">Vueforge SSR error</div>
<h1>${title}</h1>
${details}
</main></body>
</html>`
}
