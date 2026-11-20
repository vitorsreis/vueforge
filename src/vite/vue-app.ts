import { access } from 'node:fs/promises'
import { join } from 'node:path'

import vue from '@vitejs/plugin-vue'
import type { InlineConfig, Plugin, UserConfig } from 'vite'

export const clientEntry = 'virtual:vueforge-client'
export const serverEntry = 'virtual:vueforge-server'
const appFile = '/src/App.vue'

function entries(): Plugin {
  return {
    name: 'vueforge-entries',

    resolveId(id) {
      if (id === clientEntry || id === serverEntry) return '\0' + id
      return undefined
    },

    load(id) {
      if (id === '\0' + clientEntry) {
        return `import { createSSRApp } from 'vue'
import App from '${appFile}'
createSSRApp(App).mount('#app')`
      }

      if (id === '\0' + serverEntry) {
        return `import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import App from '${appFile}'
export const render = (props) => renderToString(createSSRApp(App, props))`
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
