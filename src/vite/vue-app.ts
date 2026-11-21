import { createHash } from 'node:crypto'
import { join } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { normalizePath } from 'vite'
import type { InlineConfig, Plugin, UserConfig } from 'vite'

import type { AppSource } from '../config.js'

export const clientEntry = 'virtual:vueforge-client'
export const serverEntry = 'virtual:vueforge-server'
export const devClientPath = '/@vueforge/client'
const templateModule = 'virtual:vueforge-template'

function entries(root: string, source: AppSource): Plugin {
  // A file-shaped ID lets Vite resolve imports relative to the project root.
  const templateId =
    source.kind === 'template'
      ? normalizePath(
          join(
            root,
            `__vueforge_template_${createHash('sha256').update(source.code).digest('hex').slice(0, 16)}.vue`,
          ),
        )
      : undefined
  const appImport = JSON.stringify(
    source.kind === 'template' ? templateModule : source.url,
  )
  const appFactory =
    source.kind === 'entry'
      ? `import * as entry from ${appImport}
async function createApp(context, props = {}) {
  const factory = 'createApp' in entry ? entry.createApp : entry.default
  if (typeof factory !== 'function') {
    throw new Error('The Vue entry must export a createApp function or a default app factory.')
  }
  const result = await factory(context, props)
  const app = result?.app ?? result
  if (typeof app?.mount !== 'function' || !app.config) {
    throw new Error('The Vue entry factory must return a Vue application or an object containing app.')
  }
  return app
}`
      : `import { camelize, createSSRApp } from 'vue'
import App from ${appImport}

// Match the names Vue reserves for VNodes instead of component props.
const reservedProps = new Set([
  '', 'key', 'ref', 'ref_for', 'ref_key', 'onVnodeBeforeMount', 'onVnodeMounted',
  'onVnodeBeforeUpdate', 'onVnodeUpdated', 'onVnodeBeforeUnmount', 'onVnodeUnmounted',
])
const optionsAPI = typeof __VUE_OPTIONS_API__ === 'undefined' || __VUE_OPTIONS_API__

function declaredProps(component, names = new Set()) {
  if (Array.isArray(component.props)) {
    for (const name of component.props) names.add(camelize(name))
  } else {
    for (const name in component.props) names.add(camelize(name))
  }
  if (optionsAPI && typeof component !== 'function') {
    if (component.extends) declaredProps(component.extends, names)
    for (const mixin of component.mixins ?? []) declaredProps(mixin, names)
  }
  return names
}

function createApp(context, props = {}) {
  const declared = declaredProps(App)
  const input = context === undefined ? props : { ...props, context }
  const rootProps = Object.fromEntries(Object.entries(input).filter(([key]) => {
    const name = camelize(key)
    return declared.has(name) && !reservedProps.has(name) && !name.startsWith('$') && name !== '__proto__'
  }))
  return createSSRApp(App, rootProps)
}`

  return {
    name: 'vueforge-entries',

    resolveId(id) {
      if (id === devClientPath) return '\0' + clientEntry
      if (id === clientEntry || id === serverEntry) return '\0' + id
      if (id === templateModule || id === templateId) return templateId
      return undefined
    },

    load(id) {
      if (id === '\0' + clientEntry) {
        return `${appFactory}
function readData(id) {
  const value = document.getElementById(id)?.textContent
  return value ? JSON.parse(value) : undefined
}
const head = document.head
const anchor = Array.from(head.childNodes).find(
  (node) => node.nodeType === Node.COMMENT_NODE && node.nodeValue === 'teleport start anchor',
)
// shortcut: Vue 3.5's teleport cursor skips existing head tags; use a public API when available.
if (anchor && !head._lpa) head._lpa = anchor
async function hydrate() {
  const app = await createApp(readData('vueforge-context'), readData('vueforge-props'))
  app.mount('#app')
}
hydrate()
function removeErrorOverlay() {
  document.querySelector('[data-vueforge-error-overlay]')?.remove()
}
function showErrorOverlay(payload) {
  const error = payload?.err ?? payload ?? {}
  removeErrorOverlay()
  const overlay = document.createElement('div')
  overlay.dataset.vueforgeErrorOverlay = 'true'
  Object.assign(overlay.style, {
    background: '#171717',
    color: '#f5f5f5',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    inset: '0',
    overflow: 'auto',
    padding: '48px 24px',
    position: 'fixed',
    zIndex: '2147483647',
  })
  const content = document.createElement('div')
  Object.assign(content.style, { margin: '0 auto', maxWidth: '1120px' })
  const title = document.createElement('h1')
  title.textContent = error.message ?? 'Vite update failed'
  Object.assign(title.style, { color: '#fecaca', fontSize: 'clamp(28px, 5vw, 52px)' })
  content.append(title)
  const location = error.loc?.file ?? error.id
  if (location) {
    const meta = document.createElement('p')
    meta.textContent = [location, error.loc?.line, error.loc?.column].filter(Boolean).join(':')
    Object.assign(meta.style, { color: '#d4d4d4', fontFamily: 'ui-monospace, monospace' })
    content.append(meta)
  }
  for (const [heading, value] of [['Source', error.frame], ['Stack trace', error.stack]]) {
    if (!value) continue
    const label = document.createElement('h2')
    label.textContent = heading
    const pre = document.createElement('pre')
    pre.textContent = value
    Object.assign(pre.style, { background: '#0f0f0f', border: '1px solid #4b2020', borderRadius: '10px', overflow: 'auto', padding: '18px', whiteSpace: 'pre' })
    content.append(label, pre)
  }
  overlay.append(content)
  document.body.append(overlay)
}
if (import.meta.hot) {
  import.meta.hot.on('vite:error', showErrorOverlay)
  import.meta.hot.on('vite:beforeUpdate', removeErrorOverlay)
}`
      }

      if (id === '\0' + serverEntry) {
        return `${appFactory}
import { renderToString } from 'vue/server-renderer'
export async function render(props, context) {
  const ssr = {}
  const app = await createApp(context, props)
  app.config.throwUnhandledErrorInProduction = true
  const content = await renderToString(app, ssr)
  return {
    content,
    teleportHead: ssr.teleports?.head ?? '',
    modules: [...(ssr.modules ?? [])],
  }
}`
      }
      if (source.kind === 'template' && id === templateId) return source.code
      return undefined
    },
  }
}

export function vueViteConfig(
  root: string,
  config: UserConfig,
  source: AppSource,
): InlineConfig {
  return {
    ...config,
    root,
    base: '/',
    configFile: false,
    plugins: [entries(root, source), vue(), ...(config.plugins ?? [])],
  }
}
