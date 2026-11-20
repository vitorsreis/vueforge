import type { HeadTag } from '../render/head.js'

export type Props = Record<string, unknown>

interface RenderedApp {
  content: string
  teleportHead: string
}

export type Render = (
  props?: Props,
) => Promise<RenderedApp & { assets: HeadTag[] }>

export function renderFrom(entry: unknown) {
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

  const render = entry.render as (props?: Props) => Promise<unknown>
  return async (props?: Props) => {
    const result = await render(props)
    if (
      typeof result !== 'object' ||
      result === null ||
      !('content' in result) ||
      typeof result.content !== 'string' ||
      !('teleportHead' in result) ||
      typeof result.teleportHead !== 'string' ||
      !('modules' in result) ||
      !Array.isArray(result.modules) ||
      !result.modules.every(
        (id: unknown): id is string => typeof id === 'string',
      )
    ) {
      throw new Error(
        'Incompatible VueForge SSR entry. Run vueforge build again.',
      )
    }
    return {
      content: result.content,
      teleportHead: result.teleportHead,
      modules: result.modules,
    }
  }
}

export function documentShell(head: string, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body><div id="app">${content}</div></body></html>`
}
