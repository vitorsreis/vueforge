import type { Render } from './renderer.js'
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

export function formattedResponseBytes(response: FormattedRenderResponse) {
  const body =
    typeof response.body === 'string'
      ? response.body
      : JSON.stringify(response.body)
  return new TextEncoder().encode(body).byteLength
}

function hydrationData(
  id: string,
  value: Record<string, unknown> | string,
): HeadTag {
  return {
    tag: 'script',
    attrs: { type: 'application/json', id },
    content: JSON.stringify(value).replaceAll('<', '\\u003c'),
  }
}

function isVueMarker(entry: HeadEntry) {
  return 'html' in entry && /^<!--(?:teleport|\[|\])/.test(entry.html)
}

function cleanContent(content: string, hydrate: boolean) {
  if (hydrate) return content
  return content.replace(
    /<!--(?:teleport(?: start anchor| anchor| start| end)?|\[|\])-->/g,
    '',
  )
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
    content: cleanContent(content, request.hydrate),
  }
}

function renderHeadEntries(
  { teleportHead, assets }: RenderResult,
  { hydrate, props, context, template }: Omit<RenderRequest, 'format'>,
  includeScripts = hydrate,
): HeadEntry[] {
  const entries: HeadEntry[] = []
  if (teleportHead) entries.push(...headEntriesFromHtml(teleportHead, hydrate))

  for (const asset of assets) {
    if (asset.tag === 'link') entries.push(asset)
    if (asset.tag === 'style') {
      entries.push({
        ...asset,
        content: (asset.content ?? '').replace(/<\/(style)/gi, '<\\/$1'),
      })
    }
  }

  if (hydrate) {
    entries.push(hydrationData('vueforge-props', props ?? {}))
    if (context !== undefined)
      entries.push(hydrationData('vueforge-context', context))
    if (template !== undefined)
      entries.push(hydrationData('vueforge-template', template))
  }

  if (includeScripts)
    entries.push(...assets.filter(({ tag }) => tag === 'script'))

  return hydrate ? entries : entries.filter((entry) => !isVueMarker(entry))
}

function renderHtmlHead(
  { teleportHead, assets }: RenderResult,
  { hydrate, props, context, template }: Omit<RenderRequest, 'format'>,
  includeScripts = hydrate,
) {
  return renderHeadEntries(
    { teleportHead, assets, content: '' },
    {
      hydrate,
      ...(props === undefined ? {} : { props }),
      ...(context === undefined ? {} : { context }),
      ...(template === undefined ? {} : { template }),
    },
    includeScripts,
  )
    .map(headEntryHtml)
    .join('')
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
        head: renderHeadEntries(result, request, development),
        content: cleanContent(result.content, request.hydrate),
      },
    }
  }

  const head = renderHtmlHead(result, request, request.hydrate || development)
  return {
    format: 'html',
    body: renderDocument(
      head,
      cleanContent(result.content, request.hydrate),
      document,
    ),
  }
}
