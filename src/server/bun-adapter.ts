import type { HttpTransport } from './transports.js'
import { isAbsolute, resolve } from 'node:path'

interface BunServer {
  stop(closeActiveConnections?: boolean): Promise<void>
  hostname?: string
  port?: number
}

interface BunRuntime {
  serve(options: Record<string, unknown>): BunServer
  file(path: string): unknown
}

export interface BunAdapterOptions {
  transport: HttpTransport
  root: string
  ssl?: { cert: string; key: string; ca?: string }
  shutdownTimeoutMs?: number
  fetch: (
    request: Request,
    server: unknown,
  ) => Response | Promise<Response> | undefined
  websocket?: Record<string, unknown>
}

export function hasBunRuntime() {
  return typeof process.versions.bun === 'string'
}

export function startBunAdapter({
  transport,
  root,
  ssl,
  shutdownTimeoutMs = 5000,
  fetch,
  websocket,
}: BunAdapterOptions) {
  const bun = (globalThis as typeof globalThis & { Bun?: BunRuntime }).Bun
  if (!bun) throw new Error('Bun runtime is required for the Bun HTTP adapter.')
  const tls = ssl
    ? {
        cert: bun.file(resolvePath(root, ssl.cert)),
        key: bun.file(resolvePath(root, ssl.key)),
        ...(ssl.ca === undefined
          ? {}
          : { ca: bun.file(resolvePath(root, ssl.ca)) }),
      }
    : undefined
  const server = bun.serve({
    fetch,
    ...(websocket === undefined ? {} : { websocket }),
    ...(tls === undefined ? {} : { tls }),
    ...(transport.kind === 'unix'
      ? { unix: transport.path }
      : { hostname: transport.host, port: transport.port }),
  })
  let closed = false
  return Promise.resolve({
    server,
    async close() {
      if (closed) return
      closed = true
      const timeout = Symbol('shutdown-timeout')
      const outcome = await Promise.race([
        server.stop(false).then(() => {
          return undefined
        }),
        new Promise<typeof timeout>((resolve) => {
          setTimeout(() => {
            resolve(timeout)
          }, shutdownTimeoutMs)
        }),
      ])
      if (outcome === timeout) await server.stop(true).catch(() => undefined)
    },
  })
}

function resolvePath(root: string, path: string) {
  return isAbsolute(path) ? path : resolve(root, path)
}
