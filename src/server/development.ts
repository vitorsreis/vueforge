import { stat } from 'node:fs/promises'
import type { Server } from 'node:http'

import { hostValidationMiddleware } from 'host-validation-middleware'
import { createServer, isRunnableDevEnvironment } from 'vite'
import { renderToString } from 'vue/server-renderer'

import { loadProjectConfig, resolveAssetBase } from '../config.js'
import { resolveAppSources } from '../config/source.js'
import type { AppSources } from '../config/source.js'
import type { VueforgeAppFactory, VueforgeConfig } from '../index.js'
import { developmentAssets } from '../vite/development-assets.js'
import { serverEntry, vueViteConfig } from '../vite/vue-app.js'
import { renderFrom, type Render } from '../render/renderer.js'
import type { HeadTag } from '../render/head.js'
import { viteCorsOptions } from './http/cors.js'

export async function developmentRenderer(
  root: string,
  project: VueforgeConfig,
  server?: Server,
  host = '127.0.0.1',
  port = 9901,
  sources?: AppSources,
) {
  const resolvedSources = sources ?? (await resolveAppSources(root, project))
  const config = project.vite ?? {}
  const hmr = config.server?.hmr

  const vite = await createServer({
    ...vueViteConfig(
      root,
      config,
      resolvedSources,
      project.document?.rootId,
      'development',
    ),
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
      ...(server === undefined
        ? {}
        : {
            ws:
              config.server?.ws === false
                ? false
                : { ...config.server?.ws, server },
          }),
    },
  })

  const ssr = vite.environments.ssr
  if (!isRunnableDevEnvironment(ssr)) {
    await vite.close()
    throw new Error('Vueforge could not initialize the Vite SSR runner.')
  }

  let lastValidRender: ReturnType<typeof renderFrom> | undefined
  let lastValidFactory: VueforgeAppFactory | undefined
  let lastValidAssets: HeadTag[] | undefined
  let lastFactoryMtime = -1
  let lastFailedFactoryMtime = -1
  const render: Render = async (context = {}, template) => {
    if (resolvedSources.kind === 'factory') {
      let factory = lastValidFactory
      const mtime =
        (await stat(resolvedSources.configFile).catch(() => undefined))
          ?.mtimeMs ?? -1
      if (mtime !== lastFactoryMtime && mtime !== lastFailedFactoryMtime) {
        try {
          const nextConfig = await loadProjectConfig(
            root,
            { command: 'serve', mode: 'development' },
            resolvedSources.configFile,
          )
          if (typeof nextConfig.main !== 'function') {
            throw new Error('The Vueforge main factory is not a function.')
          }
          factory = nextConfig.main as VueforgeAppFactory
          lastValidFactory = factory
          lastFactoryMtime = mtime
          lastFailedFactoryMtime = -1
        } catch (error) {
          if (factory === undefined) throw error
          lastFailedFactoryMtime = mtime
          console.error(error)
        }
      }

      if (factory === undefined) {
        throw new Error('The Vueforge main factory is not available.')
      }

      const result = await factory(context, {
        target: 'server',
        mode: 'development',
      })
      const candidate: unknown = result
      const app =
        candidate !== null &&
        typeof candidate === 'object' &&
        'app' in candidate
          ? candidate.app
          : candidate
      if (
        typeof app !== 'object' ||
        app === null ||
        !('mount' in app) ||
        typeof app.mount !== 'function' ||
        !('config' in app) ||
        typeof app.config !== 'object' ||
        app.config === null
      ) {
        throw new Error(
          'The Vueforge main factory must return a Vue application or an object containing app.',
        )
      }
      const appConfig = app.config as {
        throwUnhandledErrorInProduction?: boolean
      }
      appConfig.throwUnhandledErrorInProduction = true
      const renderState = {} as {
        modules?: Set<string>
        teleports?: Record<string, string>
      }
      const content = await renderToString(app as never, renderState)
      let assets = lastValidAssets
      try {
        assets = await developmentAssets(
          vite.environments.client,
          [...(renderState.modules ?? [])],
          resolveAssetBase(project.origin, project.base),
        )
        lastValidAssets = assets
      } catch (error) {
        if (assets === undefined) throw error
        console.error(error)
      }
      return {
        content,
        teleportHead: renderState.teleports?.head ?? '',
        context,
        assets,
      }
    }

    // Import per request so Vite can invalidate changed config factories during HMR.
    let renderApp = lastValidRender
    try {
      const entry = await ssr.runner.import<unknown>(serverEntry)
      renderApp = renderFrom(entry)
    } catch (error) {
      if (renderApp === undefined) throw error
      console.error(error)
    }
    const {
      content,
      teleportHead,
      modules,
      context: renderedContext,
    } = await renderApp(context, template)
    lastValidRender = renderApp
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
