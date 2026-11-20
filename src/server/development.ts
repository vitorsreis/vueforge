import type { Server } from 'node:http'

import { createServer, isRunnableDevEnvironment } from 'vite'
import type { UserConfig } from 'vite'

import { developmentAssets } from '../vite/development-assets.js'
import { serverEntry, requireApp, vueViteConfig } from '../vite/vue-app.js'
import { renderFrom, type Props } from './renderer.js'

export async function developmentRenderer(
  root: string,
  config: UserConfig,
  server: Server,
  host: string,
  port: number,
) {
  await requireApp(root)

  const vite = await createServer({
    ...vueViteConfig(root, config),
    appType: 'custom',
    server: {
      ...config.server,
      host,
      port,
      middlewareMode: true,
      ws:
        config.server?.ws === false ? false : { ...config.server?.ws, server },
    },
  })

  const ssr = vite.environments.ssr
  if (!isRunnableDevEnvironment(ssr)) {
    await vite.close()
    throw new Error('VueForge could not initialize the Vite SSR runner.')
  }

  const render = async (props?: Props) => {
    const entry = await ssr.runner.import<unknown>(serverEntry)
    const renderApp = renderFrom(entry)
    const { content, teleportHead, modules } = await renderApp(props)
    return {
      content,
      teleportHead,
      assets: await developmentAssets(vite.environments.client, modules),
    }
  }

  return {
    render,
    transformDocument: (url: string, html: string) =>
      vite.transformIndexHtml(url, html),
    middleware: vite.middlewares,
    close: () => vite.close(),
  }
}
