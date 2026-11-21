import type { HttpTransport } from '../transports.js'
import { isAbsolute, resolve } from 'node:path'
import { isHostAllowed } from 'host-validation-middleware'

interface BunServer {
  stop(closeActiveConnections?: boolean): Promise<void>
  hostname?: string
  port?: number
}

interface BunWebSocket<T> {
  data: T
  send(data: string | ArrayBuffer | ArrayBufferView): void
  close(code?: number, reason?: string): void
}

interface BunProxyServer extends BunServer {
  upgrade(
    request: Request,
    options: { data: { path: string; upstream?: WebSocket } },
  ): boolean
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

export interface BunProxyAdapterOptions {
  transport: HttpTransport
  root: string
  targetOrigin: string
  ssl?: { cert: string; key: string; ca?: string }
  shutdownTimeoutMs?: number
  allowedHosts?: true | readonly string[]
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

export function startBunProxyAdapter({
  transport,
  root,
  targetOrigin,
  ssl,
  shutdownTimeoutMs = 5000,
  allowedHosts = true,
}: BunProxyAdapterOptions) {
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
    fetch: (request: Request, current: BunProxyServer) => {
      const host = request.headers.get('host') ?? undefined
      if (allowedHosts !== true && !isHostAllowed(host, allowedHosts)) {
        return new Response(
          `Blocked request. This host (${JSON.stringify(host?.replace(/:\d+$/, '') ?? '')}) is not allowed.`,
          { status: 403 },
        )
      }
      if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const path = new URL(request.url).pathname + new URL(request.url).search
        if (current.upgrade(request, { data: { path } })) return undefined
        return new Response('WebSocket upgrade failed.', { status: 426 })
      }

      const target = new URL(request.url)
      const origin = new URL(targetOrigin)
      target.protocol = origin.protocol
      target.hostname = origin.hostname
      target.port = origin.port

      const headers = new Headers(request.headers)
      headers.delete('connection')
      headers.delete('host')
      headers.delete('upgrade')
      const init = {
        method: request.method,
        headers,
        ...(request.method === 'GET' || request.method === 'HEAD'
          ? {}
          : { body: request.body }),
      }
      return fetch(target, init)
    },
    websocket: {
      open(socket: BunWebSocket<{ path: string; upstream?: WebSocket }>) {
        const upstream = new WebSocket(
          targetOrigin.replace(/^http/, 'ws') + socket.data.path,
          'vite-hmr',
        )
        socket.data.upstream = upstream
        upstream.addEventListener('message', (event) => {
          if (typeof event.data === 'string') socket.send(event.data)
          else if (event.data instanceof ArrayBuffer) socket.send(event.data)
        })
        upstream.addEventListener('close', () => {
          socket.close()
        })
        upstream.addEventListener('error', () => {
          socket.close(1011, 'HMR proxy failed')
        })
      },
      message(
        socket: BunWebSocket<{ upstream?: WebSocket }>,
        message: string | ArrayBuffer,
      ) {
        const upstream = socket.data.upstream
        if (upstream?.readyState === WebSocket.OPEN) {
          upstream.send(message)
        }
      },
      close(socket: BunWebSocket<{ upstream?: WebSocket }>) {
        socket.data.upstream?.close()
      },
    },
    ...(tls === undefined ? {} : { tls }),
    ...(transport.kind === 'unix'
      ? { unix: transport.path }
      : { hostname: transport.host, port: transport.port }),
  }) as BunProxyServer

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
      if (outcome === timeout)
        await server.stop(true).catch(() => {
          return undefined
        })
    },
  })
}

function resolvePath(root: string, path: string) {
  return isAbsolute(path) ? path : resolve(root, path)
}
