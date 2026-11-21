import type { Render } from '../server/renderer.js'
import { headEntriesFromHtml, headEntryHtml } from './head.js'
import type { HeadEntry, HeadTag } from '../index.js'
import type { RenderRequest } from './request.js'
import { renderDocument, type DocumentOptions } from './document.js'

type RenderResult = Awaited<ReturnType<Render>>

interface RenderResponse<Head> {
  head: Head
  content: string
}

export type FormattedRenderResponse =
  | { format: 'json'; body: RenderResponse<HeadEntry[]> }
  | { format: 'html'; body: string }

export interface FormatRenderOptions {
  document?: DocumentOptions
  development?: boolean
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
  { format, ...request }: RenderRequest,
): RenderResponse<string | HeadEntry[]> {
  const entries = renderHeadEntries({ teleportHead, assets, content }, request)

  return {
    head: format === 'html' ? entries.map(headEntryHtml).join('') : entries,
    content,
  }
}

function renderHeadEntries(
  { teleportHead, assets }: RenderResult,
  { hydrate, props, context }: Omit<RenderRequest, 'format'>,
  includeScripts = hydrate,
): HeadEntry[] {
  const entries: HeadEntry[] = []
  if (teleportHead) entries.push(...headEntriesFromHtml(teleportHead))

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
  }

  if (includeScripts)
    entries.push(...assets.filter(({ tag }) => tag === 'script'))

  return entries
}

/** Formats a render as a JSON envelope or a complete HTML document. */
export function formatRenderResponse(
  result: RenderResult,
  request: RenderRequest,
  { document = {}, development = false }: FormatRenderOptions = {},
): FormattedRenderResponse {
  if (request.format === 'json') {
    return {
      format: 'json',
      body: {
        head: renderHeadEntries(result, request),
        content: result.content,
      },
    }
  }

  const head = renderHeadEntries(
    result,
    request,
    request.hydrate || development,
  )
  return {
    format: 'html',
    body: renderDocument(head, result.content, document),
  }
}
