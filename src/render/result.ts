import type { Render } from '../server/renderer.js'
import { headEntryHtml } from './head.js'
import type { HeadEntry } from './head.js'
import type { RenderRequest } from './request.js'

type RenderResult = Awaited<ReturnType<Render>>

interface RenderResponse<Head> {
  head: Head
  content: string
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
  { format, hydrate, props }: RenderRequest,
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
    entries.push({
      tag: 'script',
      attrs: { type: 'application/json', id: 'vueforge-props' },
      content: JSON.stringify(props ?? {}).replaceAll('<', '\\u003c'),
    })
    entries.push(...assets.filter(({ tag }) => tag === 'script'))
  }

  return {
    head: format === 'html' ? entries.map(headEntryHtml).join('') : entries,
    content,
  }
}
