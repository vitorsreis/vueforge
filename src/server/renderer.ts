import type { HeadTag } from '../render/head.js'

export type Props = Record<string, unknown>

interface RenderedApp {
  content: string
  teleportHead: string
}

type RenderEntry = (
  props?: Props,
  context?: Record<string, unknown>,
) => Promise<RenderedApp & { modules: string[] }>

export type Render = (
  props?: Props,
  context?: Record<string, unknown>,
) => Promise<RenderedApp & { assets: HeadTag[] }>

export function renderFrom(entry: unknown): RenderEntry {
  if (
    typeof entry !== 'object' ||
    entry === null ||
    !('render' in entry) ||
    typeof entry.render !== 'function'
  ) {
    throw new Error(
      'VueForge could not load the SSR entry. Run vueforge build again.',
    )
  }

  return entry.render as RenderEntry
}

export function documentShell(head: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body><div id="app">${content}</div></body></html>`
}
