import { createHash } from 'node:crypto'
import { join } from 'node:path'

import vue from '@vitejs/plugin-vue'
import { normalizePath } from 'vite'
import type { InlineConfig, Plugin, UserConfig } from 'vite'

import type { AppSources, AppTemplate } from '../config/source.js'
import type { VueforgeMode } from '../index.js'

export const clientEntry = 'virtual:vueforge-client'
export const serverEntry = 'virtual:vueforge-server'
export const devClientPath = '/@vueforge/client'

function templateId(root: string, name: string, source: AppTemplate) {
  const value = source.kind === 'template' ? source.code : source.url
  return normalizePath(
    join(
      root,
      `__vueforge_template_${createHash('sha256')
        .update(`${name}:${value}`)
        .digest('hex')
        .slice(0, 16)}.vue`,
    ),
  )
}

function importSource(source: AppTemplate, id: string) {
  return source.kind === 'template' ? id : source.url
}

function componentFactory(
  imports: string,
  selected: string,
  requireTemplate: boolean,
) {
  const selection = requireTemplate
    ? `const App = templates[template]
  if (!App) throw new Error(
    'Unknown Vueforge template "' + template + '".',
  )`
    : `const App = templates.default`

  return `${imports}
const templates = ${selected}

const reservedProps = new Set([
  '', 'key', 'ref', 'ref_for', 'ref_key', 'onVnodeBeforeMount', 'onVnodeMounted',
  'onVnodeBeforeUpdate', 'onVnodeUpdated', 'onVnodeBeforeUnmount', 'onVnodeUnmounted',
])
const optionsAPI = typeof __VUE_OPTIONS_API__ === 'undefined' || __VUE_OPTIONS_API__

function declaredProps(component, names = new Set()) {
  if (Array.isArray(component.props)) {
    for (const name of component.props) names.add(camelize(name))
  } else {
    for (const name in component.props ?? {}) names.add(camelize(name))
  }
  if (optionsAPI && typeof component !== 'function') {
    if (component.extends) declaredProps(component.extends, names)
    for (const mixin of component.mixins ?? []) declaredProps(mixin, names)
  }
  return names
}

function createComponentApp(context = {}, template) {
  ${selection}
  const declared = declaredProps(App)
  const input = context.props ?? {}
  const rootProps = Object.fromEntries(Object.entries(input).filter(([key]) => {
    const name = camelize(key)
    return declared.has(name) && !reservedProps.has(name) && !name.startsWith('$') && name !== '__proto__'
  }))
  return createSSRApp(App, rootProps)
}`
}

function entryFactory(source: string) {
  return `import * as entry from ${JSON.stringify(source)}
async function createEntryApp(context, _template, runtime) {
  const factory = entry.createApp ?? entry.default
  if (typeof factory !== 'function') throw new Error(
    'The Vue entry must export a createApp function or a default app factory.',
  )
  const result = await factory(context, runtime)
  const app = result?.app ?? result
  if (typeof app?.mount !== 'function' || !app.config) throw new Error(
    'The Vue entry factory must return a Vue application or an object containing app.',
  )
  return app
}`
}

function configFactory(source: string) {
  return `import config from ${JSON.stringify(source)}
async function createFactoryApp(context, _template, runtime) {
  const factory = config.main
  if (typeof factory !== 'function') throw new Error(
    'The Vueforge main factory is not a function.',
  )
  const result = await factory(context, runtime)
  const app = result?.app ?? result
  if (typeof app?.mount !== 'function' || !app.config) throw new Error(
    'The Vueforge main factory must return a Vue application or an object containing app.',
  )
  return app
}`
}

function entries(
  root: string,
  sources: AppSources,
  rootId: string,
  mode: VueforgeMode,
): Plugin {
  const inline = new Map<string, string>()
  let appFactory: string

  if (sources.kind === 'entry') {
    appFactory = entryFactory(sources.url)
  } else if (sources.kind === 'factory') {
    appFactory = configFactory(sources.configFile)
  } else {
    const templates: Record<string, AppTemplate> =
      sources.kind === 'templates'
        ? sources.templates
        : { default: sources.template }
    const imports: string[] = ["import { camelize, createSSRApp } from 'vue'"]
    const selected: string[] = []
    for (const [name, source] of Object.entries(templates)) {
      const id =
        source.kind === 'template' ? templateId(root, name, source) : source.url
      const importId = importSource(source, id)
      if (source.kind === 'template') inline.set(id, source.code)
      const variable = `Template${String(selected.length)}`
      imports.push(`import ${variable} from ${JSON.stringify(importId)}`)
      selected.push(`${JSON.stringify(name)}: ${variable}`)
    }
    appFactory = componentFactory(
      imports.join('\n'),
      `{ ${selected.join(', ')} }`,
      sources.kind === 'templates',
    )
  }

  return {
    name: 'vueforge-entries',

    handleHotUpdate(context) {
      if (
        sources.kind === 'factory' &&
        normalizePath(context.file) === normalizePath(sources.configFile)
      ) {
        context.server.ws.send({ type: 'full-reload', path: '*' })
      }
      return undefined
    },

    resolveId(id) {
      if (id === devClientPath) return '\0' + clientEntry
      if (id === clientEntry || id === serverEntry) return '\0' + id
      if (inline.has(id)) return id
      return undefined
    },

    load(id) {
      const inlineCode = inline.get(id)
      if (inlineCode !== undefined) return inlineCode

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
if (anchor && !head._lpa) head._lpa = anchor
async function hydrate() {
  const payload = readData('__VUEFORGE__') ?? {}
  const context = payload.context ?? payload
  const template = payload.template
  const app = ${sources.kind === 'entry' ? 'await createEntryApp' : sources.kind === 'factory' ? 'await createFactoryApp' : 'createComponentApp'}(context, template, { target: 'client', mode: ${JSON.stringify(mode)} })
  const root = document.getElementById(${JSON.stringify(rootId)})
  if (!root) throw new Error(${JSON.stringify(`Vueforge hydration root was not found: ${rootId}`)})
  app.mount(root)
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
  Object.assign(overlay.style, { background: '#171717', color: '#f5f5f5', fontFamily: 'ui-sans-serif, system-ui, sans-serif', inset: '0', overflow: 'auto', padding: '48px 24px', position: 'fixed', zIndex: '2147483647' })
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
export async function render(context = {}, template) {
  const ssr = {}
  const app = await ${sources.kind === 'entry' ? 'createEntryApp' : sources.kind === 'factory' ? 'createFactoryApp' : 'createComponentApp'}(context, template, { target: 'server', mode: ${JSON.stringify(mode)} })
  app.config.throwUnhandledErrorInProduction = true
  const content = await renderToString(app, ssr)
  return { content, teleportHead: ssr.teleports?.head ?? '', modules: [...(ssr.modules ?? [])], context }
}`
      }
      return undefined
    },
  }
}

export function vueViteConfig(
  root: string,
  config: UserConfig,
  sources: AppSources,
  rootId = 'app',
  mode: VueforgeMode = 'development',
): InlineConfig {
  return {
    ...config,
    mode,
    root,
    base: '/',
    configFile: false,
    plugins: [
      entries(root, sources, rootId, mode),
      vue(),
      ...(config.plugins ?? []),
    ],
  }
}
