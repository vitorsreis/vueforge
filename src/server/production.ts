import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import express from 'express'
import type { Manifest } from 'vite'

import { documentShell, renderFrom } from './renderer.js'

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

  const styles = chunks
    .filter((chunk) => chunk.file.endsWith('.css'))
    .map((chunk) => `<link rel="stylesheet" href="/${chunk.file}">`)
    .join('')

  const html = documentShell('/' + client.file, styles)
  const render = renderFrom(await import(pathToFileURL(entry).href))

  return {
    render,
    template: () => html,
    middleware: express.static(clientDir),
    close: undefined,
  }
}
