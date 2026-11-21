import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import { loadConfigFromFile, mergeConfig, normalizePath } from 'vite'
import type { ConfigEnv } from 'vite'

import type { VueForgeConfig } from './index.js'

export type AppSource =
  { kind: 'file' | 'entry'; url: string } | { kind: 'template'; code: string }

export async function resolveAppSource(
  root: string,
  config: VueForgeConfig,
): Promise<AppSource> {
  const fields = (['file', 'template', 'entry'] as const).filter(
    (field) => config[field] !== undefined,
  )
  if (fields.length > 1) {
    throw new Error(
      'vueforge.config.ts: choose only one of file, template, or entry.',
    )
  }

  const field = fields[0]
  const value = field === undefined ? 'src/App.vue' : config[field]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `vueforge.config.ts: ${String(field)} must be a non-empty string.`,
    )
  }
  if (field === 'template') return { kind: 'template', code: value }

  const file = resolve(root, value)
  const path = relative(root, file)
  if (
    isAbsolute(value) ||
    isAbsolute(path) ||
    path === '..' ||
    path.startsWith('..' + sep) ||
    /[?#]/.test(value)
  ) {
    throw new Error(
      `vueforge.config.ts: ${String(field)} must be a file path inside the project.`,
    )
  }
  if (field === 'file' && extname(file) !== '.vue') {
    throw new Error('vueforge.config.ts: file must point to a .vue component.')
  }
  if (!(await stat(file).catch(() => undefined))?.isFile()) {
    throw new Error(
      field === undefined
        ? 'VueForge expects src/App.vue in the current project.'
        : `vueforge.config.ts: ${field} does not exist or is not a file: ${value}`,
    )
  }

  return { kind: field ?? 'file', url: '/' + normalizePath(path) }
}

export async function loadProjectConfig(root: string, env: ConfigEnv) {
  const file = join(root, 'vueforge.config.ts')

  const projectConfig = existsSync(file)
    ? await loadConfigFromFile(env, file, root)
    : undefined
  if (existsSync(file) && !projectConfig) {
    throw new Error('Could not load vueforge.config.ts.')
  }

  const viteConfig = await loadConfigFromFile(env, undefined, root)
  const config = (projectConfig?.config ?? {}) as Record<string, unknown>
  if (
    config.vite !== undefined &&
    (typeof config.vite !== 'object' ||
      config.vite === null ||
      Array.isArray(config.vite))
  ) {
    throw new Error('vueforge.config.ts: vite must be an object.')
  }

  if (viteConfig) {
    config.vite = mergeConfig(
      viteConfig.config,
      (config.vite ?? {}) as Record<string, unknown>,
    )
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
