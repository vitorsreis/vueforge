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
      ? `import factory from ${appImport}
const createApp = (context, props = {}) => factory(context, props)`
      : `import { createSSRApp } from 'vue'
import App from ${appImport}
const createApp = (context, props) =>
  createSSRApp(App, context === undefined ? props : { ...props, context })`

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
hydrate()`
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
