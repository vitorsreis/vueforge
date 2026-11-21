import { chmod, lstat, unlink } from 'node:fs/promises'
import type { Server } from 'node:http'

export interface TcpTransport {
  kind: 'tcp'
  host: string
  port: number
}

export interface UnixTransport {
  kind: 'unix'
  path: string
}

export type HttpTransport = TcpTransport | UnixTransport

export type ServerTransport = HttpTransport | { kind: 'stdio' }

export class TransportConfigurationError extends Error {
  override name = 'TransportConfigurationError'
}

export class UnixSocketExistsError extends Error {
  override name = 'UnixSocketExistsError'
}

export interface UnixSocketIdentity {
  dev: number | bigint
  ino: number | bigint
}

function identity(
  value: Awaited<ReturnType<typeof lstat>>,
): UnixSocketIdentity {
  return { dev: value.dev, ino: value.ino }
}

export function validateTransportSelection({
  host,
  port,
  unix,
  stdio = false,
}: {
  host?: string
  port?: number
  unix?: string
  stdio?: boolean
}): void {
  if (stdio && unix !== undefined) {
    throw new TransportConfigurationError(
      'The stdio and Unix transports cannot be used together.',
    )
  }

  if (unix !== undefined && (host !== undefined || port !== undefined)) {
    throw new TransportConfigurationError(
      'The Unix transport cannot be used with host or port.',
    )
  }
}

export async function assertUnixSocketPathAvailable(
  path: string,
): Promise<void> {
  const existing = await lstat(path).catch(() => undefined)
  if (existing !== undefined) {
    throw new UnixSocketExistsError(`Unix socket path already exists: ${path}`)
  }
}

export async function captureUnixSocket(
  path: string,
): Promise<UnixSocketIdentity> {
  const created = await lstat(path).catch(() => undefined)
  if (created === undefined) {
    throw new Error(`VueForge could not verify the Unix socket path: ${path}`)
  }
  return identity(created)
}

export async function releaseUnixSocket(
  path: string,
  socket: UnixSocketIdentity,
): Promise<void> {
  const current = await lstat(path).catch(() => undefined)
  if (
    current !== undefined &&
    identity(current).dev === socket.dev &&
    identity(current).ino === socket.ino
  ) {
    await unlink(path)
  }
}

export async function listenHttpServer(
  server: Server,
  transport: HttpTransport,
): Promise<{ transport: HttpTransport; socket?: UnixSocketIdentity }> {
  let socket: UnixSocketIdentity | undefined

  if (transport.kind === 'unix') {
    await assertUnixSocketPathAvailable(transport.path)
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    if (transport.kind === 'unix') {
      server.listen(transport.path)
    } else {
      server.listen(transport.port, transport.host)
    }
  })

  try {
    if (transport.kind === 'unix')
      socket = await captureUnixSocket(transport.path)
    if (transport.kind === 'unix' && process.platform !== 'win32')
      await chmod(transport.path, 0o600)
  } catch (error) {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
    throw error
  }

  return { transport, ...(socket === undefined ? {} : { socket }) }
}

export async function closeHttpServer(
  server: Server,
  listening: { transport: HttpTransport; socket?: UnixSocketIdentity },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })

  if (listening.transport.kind !== 'unix' || listening.socket === undefined)
    return

  await releaseUnixSocket(listening.transport.path, listening.socket)
}
