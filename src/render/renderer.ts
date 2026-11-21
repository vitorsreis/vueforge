import type { HeadTag } from './head.js'

export type RenderContext = Record<string, unknown>

interface RenderedApp {
  content: string
  teleportHead: string
  context: RenderContext | undefined
}

export type AppRender = (
  context?: RenderContext,
  template?: string,
) => Promise<RenderedApp>

type RenderEntry = (
  ...args: Parameters<AppRender>
) => Promise<RenderedApp & { modules: string[] }>

export type Render = (
  ...args: Parameters<AppRender>
) => Promise<RenderedApp & { assets: HeadTag[] }>

export function renderFrom(entry: unknown): RenderEntry {
  if (
    typeof entry !== 'object' ||
    entry === null ||
    !('render' in entry) ||
    typeof entry.render !== 'function'
  ) {
    throw new Error(
      'Vueforge could not load the SSR entry. Run vueforge build again.',
    )
  }

  return entry.render as RenderEntry
}
