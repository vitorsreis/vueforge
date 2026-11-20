import { resolve } from 'node:path'

import { isCSSRequest, normalizePath, parseSync } from 'vite'
import type { DevEnvironment, TransformResult } from 'vite'

import type { HeadTag } from '../render/head.js'
import { devClientPath } from './vue-app.js'

const viteClientPath = '/@vite/client'
const staticImports = new WeakMap<TransformResult, string[]>()

function importedUrls(result: TransformResult) {
  const cached = staticImports.get(result)
  if (cached) return cached

  const urls: string[] = []
  for (const statement of parseSync('module.js', result.code).program.body) {
    if (
      statement.type === 'ImportDeclaration' ||
      statement.type === 'ExportAllDeclaration' ||
      statement.type === 'ExportNamedDeclaration'
    ) {
      if (statement.source) urls.push(statement.source.value)
    }
  }
  staticImports.set(result, urls)
  return urls
}

export async function developmentAssets(
  client: DevEnvironment,
  modules: string[],
): Promise<HeadTag[]> {
  const styles = new Map<string, HeadTag>()
  const visited = new Set([viteClientPath])

  async function visit(url: string) {
    if (visited.has(url)) return
    visited.add(url)

    const result = await client.transformRequest(url)
    if (!result) return

    if (isCSSRequest(url)) {
      // shortcut: Vite's CSS wrapper exposes the browser style ID and text, switch to a public API when available.
      const id = /^const __vite__id\s*=\s*("(?:[^"\\]|\\.)*")/m.exec(
        result.code,
      )?.[1]
      const css = /^const __vite__css\s*=\s*("(?:[^"\\]|\\.)*")/m.exec(
        result.code,
      )?.[1]
      if (id && css) {
        const devId = JSON.parse(id) as string
        styles.set(devId, {
          tag: 'style',
          attrs: { 'data-vite-dev-id': devId },
          content: JSON.parse(css) as string,
        })
      }
      return
    }

    for (const imported of importedUrls(result)) {
      if (!imported.startsWith('/') || imported.startsWith('//')) continue
      const decoded = decodeURI(imported)
        .replace(/([?&])import(?:&|$)/, '$1')
        .replace(/[?&]$/, '')
      const url = decoded.startsWith('/@id/')
        ? decoded.slice('/@id/'.length).replace('__x00__', '\0')
        : decoded
      await visit(url)
    }
  }

  await visit(devClientPath)
  for (const module of modules) {
    const url = module.startsWith('../')
      ? '/@fs/' + normalizePath(resolve(client.config.root, module))
      : '/' + module
    await visit(url)
  }

  return [
    ...styles.values(),
    ...[viteClientPath, devClientPath].map((src): HeadTag => ({
      tag: 'script',
      attrs: { type: 'module', src },
    })),
  ]
}
