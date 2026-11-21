import { createServer, type Server } from 'node:http'
import { createServer as createSecureServer } from 'node:https'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

import type { HttpTransport } from '../transports/http.js'
import { closeHttpServer, listenHttpServer } from '../transports/http.js'

export interface NodeAdapterOptions {
  transport: HttpTransport
  root: string
  ssl?: { cert: string; key: string; ca?: string }
  shutdownTimeoutMs?: number
  server?: Server
  requestHandler: (
    request: import('node:http').IncomingMessage,
    response: import('node:http').ServerResponse,
  ) => void
}

export async function createNodeServer(
  root: string,
  ssl: NodeAdapterOptions['ssl'],
  requestHandler: NodeAdapterOptions['requestHandler'],
): Promise<Server> {
  if (!ssl) return createServer(requestHandler)
  return createSecureServer(
    {
      cert: await readFile(resolvePath(root, ssl.cert)),
      key: await readFile(resolvePath(root, ssl.key)),
      ...(ssl.ca === undefined
        ? {}
        : { ca: await readFile(resolvePath(root, ssl.ca)) }),
    },
    requestHandler,
  )
}

export async function startNodeAdapter({
  transport,
  root,
  ssl,
  shutdownTimeoutMs = 5000,
  server: existingServer,
  requestHandler,
}: NodeAdapterOptions) {
  const server: Server =
    existingServer ?? (await createNodeServer(root, ssl, requestHandler))
  server.requestTimeout = 30_000
  server.headersTimeout = 10_000
  if (existingServer?.listenerCount('request') === 0)
    existingServer.on('request', requestHandler)
  const listening = await listenHttpServer(server, transport)
  let closed = false
  return {
    server,
    listening,
    async close() {
      if (closed) return
      closed = true
      const closing = closeHttpServer(server, listening)
      const timeout = Symbol('shutdown-timeout')
      let timer: ReturnType<typeof setTimeout> | undefined
      let outcome: undefined | typeof timeout
      try {
        outcome = await Promise.race([
          closing.then((): undefined => undefined),
          new Promise<typeof timeout>((resolve) => {
            timer = setTimeout(() => {
              resolve(timeout)
            }, shutdownTimeoutMs)
          }),
        ])
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
      if (server.listening) server.closeAllConnections()
      if (outcome !== timeout) await closing.catch(() => undefined)
    },
  }
}

function resolvePath(root: string, path: string) {
  return isAbsolute(path) ? path : resolve(root, path)
}
