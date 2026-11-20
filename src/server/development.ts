import type { Server } from 'node:http'

import { createServer, isRunnableDevEnvironment } from 'vite'
import type { UserConfig } from 'vite'

import {
  clientEntry,
  serverEntry,
  requireApp,
  vueViteConfig,
} from '../vite/vue-app.js'
import { documentShell, renderFrom, type Render } from './renderer.js'

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

  const render: Render = async (props) => {
    const entry = await ssr.runner.import<unknown>(serverEntry)
    const renderApp = renderFrom(entry)
    return renderApp(props)
  }

  const template = (url: string) =>
    vite.transformIndexHtml(url, documentShell('/@id/' + clientEntry))

  return {
    render,
    template,
    middleware: vite.middlewares,
    close: () => vite.close(),
  }
}
