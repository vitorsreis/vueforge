import { readdir, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'

import { normalizePath } from 'vite'
import type { Component } from 'vue'

import type { VueforgeConfig, VueforgeTemplate } from '../index.js'

export type AppTemplate =
  { kind: 'component'; url: string } | { kind: 'template'; code: string }

export interface AppSources {
  entry?: string
  template?: AppTemplate
  templates?: Record<string, AppTemplate>
}

function componentFile(value: Component): string | undefined {
  const file = (value as { __file?: unknown }).__file
  return typeof file === 'string' ? file : undefined
}

function isInlineSfc(value: string) {
  return /^\s*<(?:template|script|style)(?:\s|>)/.test(value)
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

async function resolveEntry(root: string, value: unknown): Promise<string> {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('vueforge.config.ts: entry must be a non-empty file path.')
  }

  const { file, path } = assertProjectPath(root, 'entry', value)
  if (
    !['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(
      extname(file).toLowerCase(),
    )
  ) {
    throw new Error(
      'vueforge.config.ts: entry must point to a .ts, .tsx, .js, .jsx, .mjs, or .cjs file.',
    )
  }
  if (!(await stat(file).catch(() => undefined))?.isFile()) {
    throw new Error(
      `vueforge.config.ts: entry does not exist or is not a file: ${value}`,
    )
  }
  return '/' + normalizePath(path)
}

async function templateFiles(
  root: string,
  directory: string,
  prefix = '',
): Promise<Record<string, VueforgeTemplate>> {
  const result: Record<string, VueforgeTemplate> = {}
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relativeName = prefix ? `${prefix}/${item.name}` : item.name
    const file = resolve(directory, item.name)
    if (item.isDirectory()) {
      Object.assign(result, await templateFiles(root, file, relativeName))
      continue
    }
    if (!item.isFile() || extname(item.name).toLowerCase() !== '.vue') continue
    const name = relativeName.slice(0, -'.vue'.length)
    assertTemplateName(name)
    result[name] = relative(root, file)
  }
  return result
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

async function resolveTemplateCatalog(
  root: string,
  value: string | Record<string, VueforgeTemplate>,
): Promise<Record<string, AppTemplate>> {
  const result: Record<string, AppTemplate> = {}
  if (typeof value === 'string') {
    const { file } = assertProjectPath(root, 'templates', value)
    if (!(await stat(file).catch(() => undefined))?.isDirectory()) {
      throw new Error(
        `vueforge.config.ts: templates is not a directory: ${value}`,
      )
    }
    const files = await templateFiles(root, file)
    if (Object.keys(files).length === 0) {
      throw new Error(
        `vueforge.config.ts: templates contains no .vue files: ${value}`,
      )
    }
    value = files
  }

  for (const [name, template] of Object.entries(value)) {
    assertTemplateName(name)
    result[name] = await resolveTemplate(root, `templates.${name}`, template)
  }
  if (Object.keys(result).length === 0) {
    throw new Error(
      'vueforge.config.ts: templates must contain at least one template.',
    )
  }
  return result
}

export async function resolveAppSources(
  root: string,
  config: VueforgeConfig,
): Promise<AppSources> {
  const configured = [
    config.entry !== undefined,
    config.template !== undefined,
    config.templates !== undefined,
  ].filter(Boolean).length
  if (configured > 1) {
    throw new Error(
      'vueforge.config.ts: configure only one of entry, template, or templates.',
    )
  }

  if (config.entry !== undefined) {
    return { entry: await resolveEntry(root, config.entry) }
  }
  if (config.templates !== undefined) {
    return { templates: await resolveTemplateCatalog(root, config.templates) }
  }
  return {
    template: await resolveTemplate(
      root,
      'template',
      config.template ?? 'src/App.vue',
    ),
  }
}

export async function resolveAppSource(
  root: string,
  config: VueforgeConfig,
): Promise<AppTemplate | { kind: 'entry'; url: string }> {
  const sources = await resolveAppSources(root, config)
  if (sources.entry) return { kind: 'entry', url: sources.entry }
  if (sources.template) return sources.template
  throw new Error(
    'vueforge.config.ts: resolveAppSource cannot represent a template catalog.',
  )
}
