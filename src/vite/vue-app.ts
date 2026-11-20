import { access } from 'node:fs/promises'
import { join } from 'node:path'

import vue from '@vitejs/plugin-vue'
import type { InlineConfig, Plugin, UserConfig } from 'vite'

export const clientEntry = 'virtual:vueforge-client'
export const serverEntry = 'virtual:vueforge-server'
export const devClientPath = '/@vueforge/client'
const appFile = '/src/App.vue'

function entries(): Plugin {
  return {
    name: 'vueforge-entries',

    resolveId(id) {
      if (id === devClientPath) return '\0' + clientEntry
      if (id === clientEntry || id === serverEntry) return '\0' + id
      return undefined
    },

    load(id) {
      if (id === '\0' + clientEntry) {
        return `import { createSSRApp } from 'vue'
import App from '${appFile}'
const props = document.getElementById('vueforge-props')?.textContent
const head = document.head
const anchor = Array.from(head.childNodes).find(
  (node) => node.nodeType === Node.COMMENT_NODE && node.nodeValue === 'teleport start anchor',
)
// shortcut: Vue 3.5's teleport cursor skips existing head tags; use a public API when available.
if (anchor && !head._lpa) head._lpa = anchor
createSSRApp(App, props ? JSON.parse(props) : undefined).mount('#app')`
      }

      if (id === '\0' + serverEntry) {
        return `import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import App from '${appFile}'
export async function render(props) {
  const context = {}
  const app = createSSRApp(App, props)
  app.config.throwUnhandledErrorInProduction = true
  const content = await renderToString(app, context)
  return {
    content,
    teleportHead: context.teleports?.head ?? '',
    modules: [...(context.modules ?? [])],
  }
}`
      }
      return undefined
    },
  }
}

export function vueViteConfig(root: string, config: UserConfig): InlineConfig {
  return {
    ...config,
    root,
    base: '/',
    configFile: false,
    plugins: [entries(), vue(), ...(config.plugins ?? [])],
  }
}

export async function requireApp(root: string) {
  await access(join(root, 'src', 'App.vue')).catch(() => {
    throw new Error('VueForge expects src/App.vue in the current project.')
  })
}
