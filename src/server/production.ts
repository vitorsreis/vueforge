import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import express from 'express'
import type { Manifest } from 'vite'

import type { HeadTag } from '../render/head.js'
import { renderFrom, type Render } from './renderer.js'

export async function productionRenderer(tempDir: string) {
  const clientDir = join(tempDir, 'client')
  const entry = join(tempDir, 'server/entry.mjs')
  const manifestFile = join(clientDir, '.vite/manifest.json')

  await Promise.all([access(entry), access(manifestFile)]).catch(() => {
    throw new Error('Build artifacts are missing. Run vueforge build first.')
  })

  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Manifest
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

  const renderApp = renderFrom(await import(pathToFileURL(entry).href))
  const render: Render = async (props, context) => {
    const { content, teleportHead } = await renderApp(props, context)
    return { content, teleportHead, assets }
  }

  return {
    render,
    middleware: express.static(clientDir),
    close: undefined,
  }
}
