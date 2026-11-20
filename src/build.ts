import { join } from 'node:path'
import { build } from 'vite'
import type { UserConfig } from 'vite'
import {
  clientEntry,
  serverEntry,
  vueViteConfig,
  requireApp,
} from './vite/vue-app.js'

export async function buildProject(
  root: string,
  tempDir: string,
  config: UserConfig = {},
) {
  await requireApp(root)

  const clientDir = join(tempDir, 'client')

  await build({
    ...vueViteConfig(root, config),
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
    ...vueViteConfig(root, config),
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
