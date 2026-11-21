import type { Render } from '../server/renderer.js'
import { headEntryHtml } from './head.js'
import type { HeadEntry, HeadTag } from './head.js'
import type { RenderRequest } from './request.js'

type RenderResult = Awaited<ReturnType<Render>>

interface RenderResponse<Head> {
  head: Head
  content: string
}

function hydrationData(id: string, value: Record<string, unknown>): HeadTag {
  return {
    tag: 'script',
    attrs: { type: 'application/json', id },
    content: JSON.stringify(value).replaceAll('<', '\\u003c'),
  }
}

export function renderResponse(
  result: RenderResult,
  request: RenderRequest & { format: 'html' },
): RenderResponse<string>
export function renderResponse(
  result: RenderResult,
  request: RenderRequest & { format: 'json' },
): RenderResponse<HeadEntry[]>
export function renderResponse(
  result: RenderResult,
  request: RenderRequest,
): RenderResponse<string | HeadEntry[]>
export function renderResponse(
  { teleportHead, assets, content }: RenderResult,
  { format, hydrate, props, context }: RenderRequest,
): RenderResponse<string | HeadEntry[]> {
  const entries: HeadEntry[] = []
  if (teleportHead) entries.push({ html: teleportHead })

  for (const asset of assets) {
    if (asset.tag === 'link') entries.push(asset)
    if (asset.tag === 'style') {
      entries.push({
        ...asset,
        // A CSS escape keeps the slash literal without ending the HTML element.
        content: (asset.content ?? '').replace(/<\/(style)/gi, '<\\/$1'),
      })
    }
  }

  if (hydrate) {
    entries.push(hydrationData('vueforge-props', props ?? {}))
    if (context !== undefined)
      entries.push(hydrationData('vueforge-context', context))
    entries.push(...assets.filter(({ tag }) => tag === 'script'))
  }

  return {
    head: format === 'html' ? entries.map(headEntryHtml).join('') : entries,
    content,
  }
}
