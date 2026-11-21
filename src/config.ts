import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'

import { loadConfigFromFile, mergeConfig, runnerImport } from 'vite'
import type { ConfigEnv, Plugin } from 'vite'

import type { VueforgeConfig, VueforgeMode } from './index.js'
export { resolveAppSource, resolveAppSources } from './config/source.js'
export type { AppSources, AppTemplate } from './config/source.js'

/** Resolves and validates a Vueforge runtime mode. */
export function resolveMode(
  value: unknown,
  fallback: VueforgeMode = 'production',
): VueforgeMode {
  if (value === undefined) return fallback
  if (value === 'development' || value === 'production') return value
  throw new Error(
    'vueforge.config.ts: mode must be "development" or "production".',
  )
}

export function resolveAssetBase(origin: unknown, base: unknown = '/') {
  if (typeof base !== 'string' || !base.trim() || !base.startsWith('/')) {
    throw new Error(
      'vueforge.config.ts: base must be a non-empty path starting with /.',
    )
  }
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  if (origin === undefined) return normalizedBase
  if (typeof origin !== 'string' || !/^https?:\/\//i.test(origin)) {
    throw new Error(
      'vueforge.config.ts: origin must be an absolute http:// or https:// URL.',
    )
  }
  return new URL(normalizedBase, origin.endsWith('/') ? origin : `${origin}/`)
    .href
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
      'The Vueforge configuration file must use .js, .mjs, .cjs, .ts, .mts, or .cts.',
    )
  }
  if (!fileStat) {
    throw new Error(`Vueforge configuration file does not exist: ${configFile}`)
  }
  if (!fileStat.isFile()) {
    throw new Error(`Vueforge configuration path is not a file: ${configFile}`)
  }

  return file
}

export async function loadProjectConfig(
  root: string,
  env: ConfigEnv,
  configFile?: string,
  explicitRoot?: string,
  inlineConfig?: Record<string, unknown>,
  modeOverride?: VueforgeMode,
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

  const config = {
    ...((projectConfig?.config ?? {}) as Record<string, unknown>),
    ...(inlineConfig ?? {}),
  }
  if (
    config.vite !== undefined &&
    (typeof config.vite !== 'object' ||
      config.vite === null ||
      Array.isArray(config.vite))
  ) {
    throw new Error('vueforge.config.ts: vite must be an object.')
  }

  const resolvedRoot = resolve(
    explicitRoot ??
      (typeof config.root === 'string' && config.root.trim()
        ? resolve(root, config.root)
        : root),
  )
  const viteMode =
    modeOverride ??
    (config.mode === 'development' || config.mode === 'production'
      ? config.mode
      : env.mode)
  const viteConfig = await loadConfigFromFile(
    { ...env, mode: viteMode },
    undefined,
    resolvedRoot,
  )

  if (viteConfig) {
    config.vite = mergeConfig(
      viteConfig.config,
      (config.vite ?? {}) as Record<string, unknown>,
    )
  }

  const resolvedConfig = { ...config, root: resolvedRoot } as VueforgeConfig
  if (file) {
    Object.defineProperty(resolvedConfig, '__vueforgeConfigFile', {
      value: file,
      enumerable: false,
    })
  }
  return resolvedConfig
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
  config: VueforgeConfig,
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
