import type { HeadTag } from './head.js'

export type Props = Record<string, unknown>

interface RenderedApp {
  content: string
  teleportHead: string
}

export type AppRender = (
  props?: Props,
  context?: Record<string, unknown>,
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
