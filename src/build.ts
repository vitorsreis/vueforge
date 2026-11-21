import { join } from 'node:path'
import { build } from 'vite'

import { resolveAppSource } from './config.js'
import type { VueForgeConfig } from './index.js'
import { clientEntry, serverEntry, vueViteConfig } from './vite/vue-app.js'

export async function buildProject(
  root: string,
  tempDir: string,
  project: VueForgeConfig = {},
) {
  const source = await resolveAppSource(root, project)
  const config = project.vite ?? {}

  const clientDir = join(tempDir, 'client')

  await build({
    ...vueViteConfig(root, config, source),
    build: {
      ...config.build,
      write: true,
      ssr: false,
      outDir: clientDir,
      manifest: true,
      cssCodeSplit: false,
      rolldownOptions: {
        ...config.build?.rolldownOptions,
        input: clientEntry,
        output: { dir: clientDir },
      },
    },
  })

  await build({
    ...vueViteConfig(root, config, source),
    ssr: { ...config.ssr, noExternal: true },
    build: {
      ...config.build,
      write: true,
      ssr: true,
      outDir: join(tempDir, 'server'),
      copyPublicDir: false,
      rolldownOptions: {
        ...config.build?.rolldownOptions,
        input: serverEntry,
        output: { entryFileNames: 'entry.mjs' },
      },
    },
  })
}
