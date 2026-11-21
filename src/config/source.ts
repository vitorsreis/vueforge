import { readdir, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'

import { normalizePath } from 'vite'
import type { Component } from 'vue'

import type {
  VueforgeAppFactory,
  VueforgeConfig,
  VueforgeMain,
  VueforgeTemplate,
  VueforgeTemplates,
} from '../index.js'

export type AppTemplate =
  { kind: 'component'; url: string } | { kind: 'template'; code: string }

export type AppSources =
  | { kind: 'component'; template: AppTemplate }
  | { kind: 'entry'; url: string }
  | { kind: 'factory'; configFile: string }
  | { kind: 'templates'; templates: Record<string, AppTemplate> }

type ConfigWithMetadata = VueforgeConfig & {
  __vueforgeConfigFile?: string
}

function componentFile(value: Component): string | undefined {
  const file = (value as { __file?: unknown }).__file
  return typeof file === 'string' ? file : undefined
}

function isInlineSfc(value: string) {
  return /^\s*<(?:template|script|style)[\s>]/.test(value)
}

function isFactory(value: unknown): value is VueforgeAppFactory {
  return typeof value === 'function'
}

function assertProjectPath(
  root: string,
  field: string,
  value: string,
  allowAbsolute = false,
) {
  const file = resolve(root, value)
  const path = relative(root, file)
  if (
    (!allowAbsolute && isAbsolute(value)) ||
    isAbsolute(path) ||
    path === '..' ||
    path.startsWith('..' + sep) ||
    /[?#]/.test(value)
  ) {
    throw new Error(
      `vueforge.config.ts: ${field} must be a file or directory inside the project.`,
    )
  }
  return { file, path }
}

async function resolveTemplate(
  root: string,
  field: string,
  value: VueforgeTemplate,
): Promise<AppTemplate> {
  if (typeof value === 'string' && isInlineSfc(value)) {
    return { kind: 'template', code: value }
  }

  const component = typeof value === 'string' ? undefined : componentFile(value)
  const pathValue = component ?? value
  if (typeof pathValue !== 'string' || !pathValue.trim()) {
    throw new Error(`vueforge.config.ts: ${field} must be a non-empty value.`)
  }

  const { file, path } = assertProjectPath(
    root,
    field,
    pathValue,
    component !== undefined,
  )
  if (extname(file).toLowerCase() !== '.vue') {
    throw new Error(`vueforge.config.ts: ${field} must point to a .vue file.`)
  }
  if (!(await stat(file).catch(() => undefined))?.isFile()) {
    throw new Error(
      `vueforge.config.ts: ${field} does not exist or is not a file: ${pathValue}`,
    )
  }

  return { kind: 'component', url: '/' + normalizePath(path) }
}

async function resolveEntry(root: string, field: string, value: string) {
  const { file, path } = assertProjectPath(root, field, value)
  if (
    !['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(
      extname(file).toLowerCase(),
    )
  ) {
    throw new Error(
      `vueforge.config.ts: ${field} must point to a .ts, .tsx, .js, .jsx, .mjs, or .cjs file.`,
    )
  }
  if (!(await stat(file).catch(() => undefined))?.isFile()) {
    throw new Error(
      `vueforge.config.ts: ${field} does not exist or is not a file: ${value}`,
    )
  }
  return '/' + normalizePath(path)
}

function assertTemplateName(name: string) {
  const segments = name.split('/')
  if (
    !name.trim() ||
    name.includes('..') ||
    name.includes('\\') ||
    segments.some((segment) =>
      ['__proto__', 'constructor', 'prototype'].includes(segment),
    )
  ) {
    throw new Error(
      'vueforge.config.ts: template names must be safe identifiers.',
    )
  }
}

async function templateFiles(
  root: string,
  directory: string,
  pattern?: RegExp,
  extension = '.vue',
  prefix = '',
): Promise<Record<string, VueforgeTemplate>> {
  const result: Record<string, VueforgeTemplate> = {}
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relativeName = prefix ? `${prefix}/${item.name}` : item.name
    const file = resolve(directory, item.name)
    if (item.isDirectory()) {
      Object.assign(
        result,
        await templateFiles(root, file, pattern, extension, relativeName),
      )
      continue
    }
    if (!item.isFile() || extname(item.name).toLowerCase() !== extension)
      continue
    if (pattern !== undefined) {
      pattern.lastIndex = 0
      if (!pattern.test(normalizePath(relativeName))) continue
    }
    const name = relativeName.slice(0, -extension.length)
    assertTemplateName(name)
    result[name] = relative(root, file)
  }
  return result
}

async function resolveTemplateCatalog(
  root: string,
  value: VueforgeTemplates,
): Promise<Record<string, AppTemplate>> {
  let candidates: Record<string, VueforgeTemplate> = {}
  let directory: string | undefined
  let pattern: RegExp | undefined
  if (typeof value === 'string') {
    directory = value
  } else if (value instanceof RegExp) {
    directory = 'src'
    pattern = value
  } else {
    candidates = value
  }

  if (directory) {
    const { file } = assertProjectPath(root, 'main', directory)
    if (!(await stat(file).catch(() => undefined))?.isDirectory()) {
      throw new Error(
        `vueforge.config.ts: main is not a directory: ${directory}`,
      )
    }
    candidates = await templateFiles(root, file, pattern)
  }

  const result: Record<string, AppTemplate> = {}
  for (const [name, template] of Object.entries(candidates)) {
    assertTemplateName(name)
    result[name] = await resolveTemplate(root, `main.${name}`, template)
  }
  if (Object.keys(result).length === 0) {
    throw new Error(
      'vueforge.config.ts: main did not select any Vue templates.',
    )
  }
  return result
}

async function resolveMain(
  root: string,
  value: VueforgeMain,
  configFile?: string,
): Promise<AppSources> {
  if (isFactory(value)) {
    if (!configFile) {
      throw new Error(
        'vueforge.config.ts: a direct main factory requires a configuration file.',
      )
    }
    return { kind: 'factory', configFile }
  }

  if (value instanceof RegExp) {
    return {
      kind: 'templates',
      templates: await resolveTemplateCatalog(root, value),
    }
  }

  if (typeof value === 'object') {
    const component = componentFile(value as Component)
    if (component) {
      return {
        kind: 'component',
        template: await resolveTemplate(root, 'main', value as Component),
      }
    }
    return {
      kind: 'templates',
      templates: await resolveTemplateCatalog(root, value),
    }
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('vueforge.config.ts: main must be a non-empty Vue source.')
  }
  if (isInlineSfc(value)) {
    return {
      kind: 'component',
      template: await resolveTemplate(root, 'main', value),
    }
  }

  const { file } = assertProjectPath(root, 'main', value)
  const fileStat = await stat(file).catch(() => undefined)
  if (fileStat?.isDirectory()) {
    return {
      kind: 'templates',
      templates: await resolveTemplateCatalog(root, value),
    }
  }
  if (extname(file).toLowerCase() === '.vue') {
    return {
      kind: 'component',
      template: await resolveTemplate(root, 'main', value),
    }
  }
  return { kind: 'entry', url: await resolveEntry(root, 'main', value) }
}

export async function resolveAppSources(
  root: string,
  config: VueforgeConfig,
): Promise<AppSources> {
  const metadata = config as ConfigWithMetadata
  return resolveMain(
    root,
    config.main ?? 'src/App.vue',
    metadata.__vueforgeConfigFile,
  )
}

export async function resolveAppSource(
  root: string,
  config: VueforgeConfig,
): Promise<AppTemplate | { kind: 'entry'; url: string }> {
  const sources = await resolveAppSources(root, config)
  if (sources.kind === 'entry') return { kind: 'entry', url: sources.url }
  if (sources.kind === 'component') return sources.template
  throw new Error(
    'vueforge.config.ts: resolveAppSource cannot represent a template catalog or factory.',
  )
}
