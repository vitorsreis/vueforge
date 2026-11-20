import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { loadConfigFromFile } from 'vite'
import type { ConfigEnv } from 'vite'

import type { VueForgeConfig } from './index.js'

export async function loadProjectConfig(root: string, env: ConfigEnv) {
  const file = join(root, 'vueforge.config.ts')

  if (!existsSync(file)) {
    return {}
  }

  const loaded = await loadConfigFromFile(env, file, root)

  if (!loaded) {
    throw new Error('Could not load vueforge.config.ts.')
  }

  const config = loaded.config as Record<string, unknown>
  if (
    config.vite !== undefined &&
    (typeof config.vite !== 'object' ||
      config.vite === null ||
      Array.isArray(config.vite))
  ) {
    throw new Error('vueforge.config.ts: vite must be an object.')
  }

  return config as VueForgeConfig
}

export function resolveTempDir(root: string, tempDir: unknown = '.vueforge') {
  if (typeof tempDir !== 'string' || !tempDir.trim()) {
    throw new Error('vueforge.config.ts: tempDir must be a non-empty path.')
  }

  return resolve(root, tempDir)
}

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
