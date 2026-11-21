import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

import {
  loadConfigFromFile,
  mergeConfig,
  normalizePath,
  runnerImport,
} from 'vite'
import type { ConfigEnv, Plugin } from 'vite'
import type { Component } from 'vue'

import type { VueForgeConfig } from './index.js'
import {
  validateTransportSelection,
  type ServerTransport,
} from './server/transports.js'

export type AppSource =
  | { kind: 'component'; url: string }
  | { kind: 'entry'; url: string }
  | { kind: 'template'; code: string }

function componentFile(value: Component): string | undefined {
  const file = (value as { __file?: unknown }).__file
  return typeof file === 'string' ? file : undefined
}

function sourceFields(config: VueForgeConfig) {
  return (['template', 'entry'] as const).filter(
    (field) => config[field] !== undefined,
  )
}

export async function resolveAppSource(
  root: string,
  config: VueForgeConfig,
): Promise<AppSource> {
  const fields = sourceFields(config)
  if (fields.length > 1) {
    throw new Error('vueforge.config.ts: choose only one of entry or template.')
  }

  const field = fields[0]
  const value = field === undefined ? 'src/App.vue' : config[field]
  if (field === 'template' && typeof value === 'string') {
    if (!value.trim()) {
      throw new Error('vueforge.config.ts: template must be non-empty.')
    }
    return { kind: 'template', code: value }
  }

  const component =
    field === 'template' && value !== undefined && typeof value !== 'string'
      ? componentFile(value)
      : undefined
  if (component !== undefined) {
    return await resolveComponentSource(root, field ?? 'template', component)
  }

  if (
    field === 'template' &&
    value !== undefined &&
    typeof value !== 'string'
  ) {
    throw new Error(
      'vueforge.config.ts: template components must expose a source .vue file.',
    )
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `vueforge.config.ts: ${String(field)} must be a non-empty path.`,
    )
  }

  if (field === 'template') {
    throw new Error(
      'vueforge.config.ts: template components must be imported Vue components with a source file.',
    )
  }

  const sourceKind =
    field === undefined || extname(value) === '.vue' ? 'component' : 'entry'
  return await resolvePathSource(root, field ?? 'entry', value, sourceKind)
}

async function resolveComponentSource(
  root: string,
  field: string,
  value: string,
): Promise<AppSource> {
  return await resolvePathSource(root, field, value, 'component')
}

async function resolvePathSource(
  root: string,
  field: string,
  value: string,
  kind: 'component' | 'entry',
): Promise<AppSource> {
  const file = resolve(root, value)
  const path = relative(root, file)

  if (
    (kind !== 'component' && isAbsolute(value)) ||
    isAbsolute(path) ||
    path === '..' ||
    path.startsWith('..' + sep) ||
    /[?#]/.test(value)
  ) {
    throw new Error(
      `vueforge.config.ts: ${field} must be a file path inside the project.`,
    )
  }
  if (kind === 'component' && extname(file) !== '.vue') {
    throw new Error(
      `vueforge.config.ts: ${field} must point to a .vue component.`,
    )
  }
  if (!(await stat(file).catch(() => undefined))?.isFile()) {
    throw new Error(
      `vueforge.config.ts: ${field} does not exist or is not a file: ${value}`,
    )
  }

  return { kind, url: '/' + normalizePath(path) }
}

const configExtensions = new Set(['.cjs', '.cts', '.js', '.mjs', '.mts', '.ts'])

function configComponentPlugin(): Plugin {
  return {
    name: 'vueforge-config-components',
    resolveId(source, importer) {
      if (importer && extname(source) === '.vue') {
        return resolve(dirname(importer), source)
      }
      return undefined
    },
    load(id) {
      if (extname(id) === '.vue') {
        return `export default { __file: ${JSON.stringify(id)} }`
      }
      return undefined
    },
  }
}

async function loadConfigWithImportedComponents(file: string, root: string) {
  const result = await runnerImport(file, {
    root,
    plugins: [configComponentPlugin()],
  })
  return {
    path: file,
    config: (result.module as { default: unknown }).default,
    dependencies: result.dependencies,
  }
}

async function importsVueComponent(file: string) {
  const source = await readFile(file, 'utf8')
  return /(?:from\s*|import\s*)['"][^'"]+\.vue(?:\?[^'"]*)?['"]/.test(source)
}

async function resolveProjectConfigFile(
  root: string,
  configFile: string | undefined,
): Promise<string | undefined> {
  const file = resolve(root, configFile ?? 'vueforge.config.ts')
  const fileStat = await stat(file).catch(() => undefined)

  if (configFile === undefined) {
    return fileStat?.isFile() ? file : undefined
  }

  if (!configExtensions.has(extname(file).toLowerCase())) {
    throw new Error(
      'The VueForge configuration file must use .js, .mjs, .cjs, .ts, .mts, or .cts.',
    )
  }
  if (!fileStat) {
    throw new Error(`VueForge configuration file does not exist: ${configFile}`)
  }
  if (!fileStat.isFile()) {
    throw new Error(`VueForge configuration path is not a file: ${configFile}`)
  }

  return file
}

export async function loadProjectConfig(
  root: string,
  env: ConfigEnv,
  configFile?: string,
  explicitRoot?: string,
) {
  const file = await resolveProjectConfigFile(root, configFile)

  let projectConfig
  if (file) {
    if (await importsVueComponent(file)) {
      projectConfig = await loadConfigWithImportedComponents(file, root)
    } else {
      try {
        projectConfig = await loadConfigFromFile(env, file, root)
      } catch (error) {
        if (!String(error).includes('.vue')) throw error
        projectConfig = await loadConfigWithImportedComponents(file, root)
      }
    }
    if (!projectConfig) {
      throw new Error(`Could not load ${relative(root, file) || file}.`)
    }
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

  const resolvedRoot = resolve(
    explicitRoot ??
      (typeof config.root === 'string' && config.root.trim()
        ? config.root
        : root),
  )
  return { ...config, root: resolvedRoot } as VueForgeConfig
}

export function resolveTempDir(root: string, tempDir: unknown = '.vueforge') {
  if (typeof tempDir !== 'string' || !tempDir.trim()) {
    throw new Error('vueforge.config.ts: tempDir must be a non-empty path.')
  }

  return resolve(root, tempDir)
}

export function resolveBuildOutputDir(root: string, outDir: unknown = 'dist') {
  if (typeof outDir !== 'string' || !outDir.trim()) {
    throw new Error(
      'vueforge.config.ts: build.outDir must be a non-empty path.',
    )
  }

  return resolve(root, outDir)
}

export interface ResolvedRenderLimits {
  maxRequestBytes: number
  maxConcurrentRenders: number
  renderTimeoutMs: number
  maxOutputBytes: number
}

export function resolveRenderLimits(
  config: VueForgeConfig,
): ResolvedRenderLimits {
  const limits = config.limits ?? {}
  const values: ResolvedRenderLimits = {
    maxRequestBytes: limits.maxRequestBytes ?? 64 * 1024,
    maxConcurrentRenders: limits.maxConcurrentRenders ?? 4,
    renderTimeoutMs: limits.renderTimeoutMs ?? 5000,
    maxOutputBytes: limits.maxOutputBytes ?? 4 * 1024 * 1024,
  }

  for (const [name, value] of Object.entries(values)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(
        `vueforge.config.ts: limits.${name} must be a positive safe integer.`,
      )
    }
  }

  return values
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
    if (typeof unix !== 'string' || !unix.trim()) {
      throw new Error('The Unix socket path must be a non-empty path.')
    }
    return {
      kind: 'unix',
      path: isAbsolute(unix) ? unix : resolve(root, unix),
    }
  }
  return { kind: 'tcp', host: listener.host, port: listener.port }
}
