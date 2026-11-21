import { isAbsolute, resolve } from 'node:path'

import type { VueForgeConfig } from '../../index.js'
import { validateTransportSelection, type ServerTransport } from './http.js'

export function listenOptions(
  config: VueForgeConfig,
  host?: string,
  port?: string,
) {
  const resolvedHost = host ?? config.host ?? '127.0.0.1'
  const resolvedPort = port === undefined ? (config.port ?? 9901) : Number(port)
  if (
    typeof resolvedHost !== 'string' ||
    !resolvedHost.trim() ||
    /[\s/]/.test(resolvedHost)
  ) {
    throw new Error('Host must be a hostname or IP address.')
  }
  if (
    (port !== undefined && !/^\d+$/.test(port)) ||
    !Number.isInteger(resolvedPort) ||
    resolvedPort < 1 ||
    resolvedPort > 65535
  ) {
    throw new Error('Port must be an integer from 1 to 65535.')
  }
  return { host: resolvedHost, port: resolvedPort }
}

export function resolveServerTransport(
  root: string,
  config: VueForgeConfig,
  overrides: {
    host?: string
    port?: string | number
    unix?: string
    stdio?: boolean
  } = {},
): ServerTransport {
  const unix = overrides.unix ?? config.unix
  const stdio = overrides.stdio ?? false
  const listener = listenOptions(
    config,
    overrides.host,
    overrides.port === undefined ? undefined : String(overrides.port),
  )
  validateTransportSelection({
    ...(unix === undefined && !stdio
      ? { host: listener.host, port: listener.port }
      : {}),
    ...(unix === undefined ? {} : { unix }),
    ...(stdio ? { stdio } : {}),
  })
  if (stdio) return { kind: 'stdio' }
  if (unix !== undefined) {
    if (!unix.trim()) throw new Error('The Unix socket path must be non-empty.')
    return { kind: 'unix', path: isAbsolute(unix) ? unix : resolve(root, unix) }
  }
  return { kind: 'tcp', host: listener.host, port: listener.port }
}
