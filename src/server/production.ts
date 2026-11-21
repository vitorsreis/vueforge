import { access, lstat, readFile, realpath } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { RequestHandler } from 'express'
import type { Manifest } from 'vite'

import { clientAssetsFile, isClientAsset } from '../client-assets.js'
import type { HeadTag } from '../render/head.js'
import { renderFrom, type AppRender, type Render } from '../render/renderer.js'

function clientMiddleware(
  clientDir: string,
  files: Set<string>,
): RequestHandler {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    let requested: string
    try {
      requested = decodeURIComponent(req.path)
    } catch {
      next()
      return
    }
    if (!requested.startsWith('/')) {
      next()
      return
    }
    let file = requested.slice(1)
    let redirectToDirectory = false
    if (!files.has(file)) {
      redirectToDirectory = !requested.endsWith('/')
      file += (redirectToDirectory ? '/' : '') + 'index.html'
      if (!files.has(file)) {
        next()
        return
      }
    }

    const path = join(clientDir, file)
    const actual = await realpath(path).catch(() => undefined)
    const relativePath = actual ? relative(clientDir, actual) : ''
    if (
      !actual ||
      relativePath === '..' ||
      relativePath.startsWith('../') ||
      relativePath.includes('..\\')
    ) {
      next()
      return
    }
    if (!(await lstat(actual).catch(() => undefined))?.isFile()) {
      next()
      return
    }
    if (redirectToDirectory) {
      const queryStart = req.url.indexOf('?')
      const query = queryStart === -1 ? '' : req.url.slice(queryStart)
      const directory = requested.split('/').map(encodeURIComponent).join('/')
      res.redirect(301, directory + '/' + query)
      return
    }
    res.sendFile(file, { root: clientDir })
  }
}

export async function productionRenderer(
  tempDir: string,
  load: (
    entry: URL,
  ) => Promise<{ render: AppRender; close?: () => Promise<void> }> = async (
    entry,
  ) => ({
    render: renderFrom(await import(entry.href)),
  }),
) {
  const clientDir = join(tempDir, 'client')
  const entry = join(tempDir, 'server/entry.mjs')
  const manifestFile = join(clientDir, '.vite/manifest.json')

  const [manifestText, inventoryText, clientPath] = await Promise.all([
    readFile(manifestFile, 'utf8'),
    readFile(join(clientDir, clientAssetsFile), 'utf8'),
    realpath(clientDir),
    access(entry),
  ]).catch(() => {
    throw new Error('Build artifacts are missing. Run vueforge build first.')
  })
  const inventory: unknown = JSON.parse(inventoryText)
  if (!Array.isArray(inventory) || !inventory.every(isClientAsset)) {
    throw new Error(
      'Client asset inventory is invalid. Run vueforge build again.',
    )
  }

  const manifest = JSON.parse(manifestText) as Manifest
  const chunks = Object.values(manifest)
  const client = chunks.find((chunk) => chunk.isEntry)

  if (!client) {
    throw new Error('Client entry is missing. Run vueforge build again.')
  }

  const assets: HeadTag[] = chunks
    .filter((chunk) => chunk.file.endsWith('.css'))
    .map((chunk) => ({
      tag: 'link',
      attrs: { rel: 'stylesheet', href: '/' + chunk.file },
    }))
  assets.push({
    tag: 'script',
    attrs: { type: 'module', src: '/' + client.file },
  })

  const { render: renderApp, close } = await load(pathToFileURL(entry))
  const render: Render = async (props, context) => {
    const { content, teleportHead } = await renderApp(props, context)
    return { content, teleportHead, assets }
  }

  return {
    render,
    middleware: clientMiddleware(clientPath, new Set(inventory)),
    close,
  }
}
