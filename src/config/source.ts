import { stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'

import { normalizePath } from 'vite'
import type { Component } from 'vue'

import type { VueForgeConfig } from '../index.js'

export type AppSource =
  | { kind: 'component'; url: string }
  | { kind: 'entry'; url: string }
  | { kind: 'template'; code: string }

function componentFile(value: Component): string | undefined {
  const file = (value as { __file?: unknown }).__file
  return typeof file === 'string' ? file : undefined
}

function isInlineSfc(value: string) {
  return /^\s*<(?:template|script|style)(?:\s|>)/.test(value)
}

export async function resolveAppSource(
  root: string,
  config: VueForgeConfig,
): Promise<AppSource> {
  const value = config.source ?? 'src/App.vue'
  if (typeof value === 'string' && isInlineSfc(value)) {
    return { kind: 'template', code: value }
  }

  const component = typeof value === 'string' ? undefined : componentFile(value)
  if (component !== undefined) {
    return await resolvePathSource(root, 'source', component, 'component')
  }

  if (typeof value !== 'string') {
    throw new Error(
      'vueforge.config.ts: source components must expose a source .vue file.',
    )
  }
  if (!value.trim()) {
    throw new Error('vueforge.config.ts: source must be a non-empty value.')
  }

  const extension = extname(value).toLowerCase()
  const kind = extension === '.vue' ? 'component' : 'entry'
  if (
    kind === 'entry' &&
    !['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)
  ) {
    throw new Error(
      'vueforge.config.ts: source must point to a .vue, .ts, .tsx, .js, .jsx, .mjs, or .cjs file.',
    )
  }

  return await resolvePathSource(root, 'source', value, kind)
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
  if (kind === 'component' && extname(file).toLowerCase() !== '.vue') {
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
