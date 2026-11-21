import type { Server } from 'node:http'

import { hostValidationMiddleware } from 'host-validation-middleware'
import { createServer, isRunnableDevEnvironment } from 'vite'

import { resolveAppSource } from '../config.js'
import type { VueForgeConfig } from '../index.js'
import { developmentAssets } from '../vite/development-assets.js'
import { serverEntry, vueViteConfig } from '../vite/vue-app.js'
import { renderFrom, type Render } from './renderer.js'

export async function developmentRenderer(
  root: string,
  project: VueForgeConfig,
  server: Server,
  host: string,
  port: number,
  hmrPort = port,
) {
  const source = await resolveAppSource(root, project)
  const config = project.vite ?? {}
  const hmr = config.server?.hmr

  const vite = await createServer({
    ...vueViteConfig(root, config, source),
    appType: 'custom',
    server: {
      ...config.server,
      host,
      port,
      middlewareMode: true,
      hmr:
        hmr === false
          ? false
          : {
              ...(typeof hmr === 'object' ? hmr : {}),
              port: hmrPort,
              overlay: false,
            },
      ws:
        config.server?.ws === false ? false : { ...config.server?.ws, server },
    },
  })

  const ssr = vite.environments.ssr
  if (!isRunnableDevEnvironment(ssr)) {
    await vite.close()
    throw new Error('VueForge could not initialize the Vite SSR runner.')
  }

  const render: Render = async (props, context) => {
    const entry = await ssr.runner.import<unknown>(serverEntry)
    const renderApp = renderFrom(entry)
    const { content, teleportHead, modules } = await renderApp(props, context)
    return {
      content,
      teleportHead,
      assets: await developmentAssets(vite.environments.client, modules),
    }
  }

  const { allowedHosts } = vite.config.server
  return {
    render,
    hostGuard:
      allowedHosts === true
        ? undefined
        : hostValidationMiddleware({ allowedHosts }),
    middleware: vite.middlewares,
    close: () => vite.close(),
  }
}
