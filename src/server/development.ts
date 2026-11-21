import type { Server } from 'node:http'

import { hostValidationMiddleware } from 'host-validation-middleware'
import { createServer, isRunnableDevEnvironment } from 'vite'

import { resolveAppSources } from '../config/source.js'
import { resolveAssetBase } from '../config.js'
import type { VueforgeConfig } from '../index.js'
import { developmentAssets } from '../vite/development-assets.js'
import { serverEntry, vueViteConfig } from '../vite/vue-app.js'
import { renderFrom, type Render } from '../render/renderer.js'
import { viteCorsOptions } from './http/cors.js'

export async function developmentRenderer(
  root: string,
  project: VueforgeConfig,
  server: Server,
  host: string,
  port: number,
) {
  const sources = await resolveAppSources(root, project)
  const config = project.vite ?? {}
  const hmr = config.server?.hmr

  const vite = await createServer({
    ...vueViteConfig(root, config, sources, project.document?.rootId),
    appType: 'custom',
    server: {
      ...config.server,
      host,
      port,
      middlewareMode: true,
      cors: viteCorsOptions(project.server?.cors ?? config.server?.cors),
      hmr:
        hmr === false
          ? false
          : {
              ...(typeof hmr === 'object' ? hmr : {}),
              overlay: false,
            },
      ws:
        config.server?.ws === false ? false : { ...config.server?.ws, server },
    },
  })

  const ssr = vite.environments.ssr
  if (!isRunnableDevEnvironment(ssr)) {
    await vite.close()
    throw new Error('Vueforge could not initialize the Vite SSR runner.')
  }

  const render: Render = async (context = {}, template) => {
    const entry = await ssr.runner.import<unknown>(serverEntry)
    const renderApp = renderFrom(entry)
    const {
      content,
      teleportHead,
      modules,
      context: renderedContext,
    } = await renderApp(context, template)
    return {
      content,
      teleportHead,
      context: renderedContext,
      assets: await developmentAssets(
        vite.environments.client,
        modules,
        resolveAssetBase(project.origin, project.base),
      ),
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
