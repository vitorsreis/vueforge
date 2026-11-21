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
