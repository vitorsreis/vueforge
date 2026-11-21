import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'
import { build } from 'vite'

import { clientAssetsFile, isClientAsset } from './build/assets.js'
import { resolveBuildOutputDir } from './config.js'
import { resolveAppSources } from './config/source.js'
import type { VueforgeConfig } from './index.js'
import { clientEntry, serverEntry, vueViteConfig } from './vite/vue-app.js'

async function prepareOutput(
  source: string,
  destination: string,
): Promise<string[]> {
  await mkdir(destination, { recursive: true })
  if (!(await lstat(destination)).isDirectory()) {
    throw new Error(`Build output must be a directory: ${destination}`)
  }

  const files: string[] = []
  for (const item of await readdir(source, { withFileTypes: true })) {
    if (item.isDirectory()) {
      const children = await prepareOutput(
        join(source, item.name),
        join(destination, item.name),
      )
      files.push(...children.map((file) => `${item.name}/${file}`))
    } else if (item.isFile()) {
      files.push(item.name)
    } else {
      throw new Error(
        `Build output must be a regular file: ${join(source, item.name)}`,
      )
    }
  }
  return files
}

export async function buildProject(
  root: string,
  tempDir: string,
  project: VueforgeConfig = {},
) {
  const sources = await resolveAppSources(root, project)
  const config = project.vite ?? {}
  const outputDir = resolveBuildOutputDir(root, project.build?.outDir)
  const buildOverrides: {
    sourcemap?: NonNullable<NonNullable<typeof config.build>['sourcemap']>
    minify?: NonNullable<NonNullable<typeof config.build>['minify']>
  } = {}
  if (project.build?.sourcemap !== undefined) {
    buildOverrides.sourcemap = project.build.sourcemap
  }
  if (project.build?.minify !== undefined) {
    buildOverrides.minify = project.build.minify
  }

  await mkdir(tempDir, { recursive: true })
  const lockFile = join(tempDir, '.build.lock')
  const lock = await open(lockFile, 'wx').catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    throw new Error('A vueforge build already holds the lock in ' + tempDir)
  })
  try {
    const staging = await mkdtemp(join(tempDir, '.build-'))
    try {
      const clientOut = join(staging, 'client')
      const serverOut = join(staging, 'server')
      await build({
        ...vueViteConfig(
          root,
          config,
          sources,
          project.document?.rootId,
          'production',
        ),
        build: {
          ...config.build,
          ...buildOverrides,
          write: true,
          watch: null,
          emptyOutDir: false,
          ssr: false,
          outDir: clientOut,
          manifest: true,
          cssCodeSplit: false,
          rolldownOptions: {
            ...config.build?.rolldownOptions,
            input: clientEntry,
            output: { dir: clientOut },
          },
        },
      })

      await build({
        ...vueViteConfig(
          root,
          config,
          sources,
          project.document?.rootId,
          'production',
        ),
        ssr: { ...config.ssr, noExternal: true },
        build: {
          ...config.build,
          ...buildOverrides,
          write: true,
          watch: null,
          emptyOutDir: false,
          ssr: true,
          outDir: serverOut,
          copyPublicDir: false,
          rolldownOptions: {
            ...config.build?.rolldownOptions,
            input: serverEntry,
            output: { dir: serverOut, entryFileNames: 'entry.mjs' },
          },
        },
      })

      const clientDir = join(outputDir, 'client')
      const serverDir = join(outputDir, 'server')
      const clientFiles = await prepareOutput(clientOut, clientDir)
      const serverFiles = await prepareOutput(serverOut, serverDir)
      const inventory = JSON.stringify(clientFiles.filter(isClientAsset).sort())
      await writeFile(join(clientOut, clientAssetsFile), inventory, {
        flag: 'wx',
      })

      for (const file of clientFiles) {
        await rename(join(clientOut, file), join(clientDir, file))
      }
      for (const file of serverFiles) {
        await rename(join(serverOut, file), join(serverDir, file))
      }
      await rename(
        join(clientOut, clientAssetsFile),
        join(clientDir, clientAssetsFile),
      )
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
  } finally {
    await lock.close()
    await rm(lockFile)
  }
}
