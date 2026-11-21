import type { Render } from './renderer.js'
import { headEntriesFromHtml, headEntryHtml } from './head.js'
import type { HeadEntry, HeadTag } from '../index.js'
import type { RenderRequest } from './request.js'
import { renderDocument, type DocumentOptions } from './document.js'

type RenderResult = Awaited<ReturnType<Render>>

export type FormattedRenderResponse =
  | {
      format: 'json'
      body: { head: HeadEntry[]; content: string; state?: unknown }
    }
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

function hydrationData(value: unknown): HeadTag {
  return {
    tag: 'script',
    attrs: { type: 'application/json', id: '__VUEFORGE__' },
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

function renderHeadEntries(
  { teleportHead, assets, context }: RenderResult,
  { hydrate, template }: Pick<RenderRequest, 'hydrate' | 'template'>,
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
    entries.push(hydrationData({ context, ...(template ? { template } : {}) }))
  }

  if (includeScripts)
    entries.push(...assets.filter(({ tag }) => tag === 'script'))

  return hydrate ? entries : entries.filter((entry) => !isVueMarker(entry))
}

function renderHtmlHead(
  { teleportHead, assets, context }: RenderResult,
  { hydrate, template }: Pick<RenderRequest, 'hydrate' | 'template'>,
  includeScripts = hydrate,
) {
  return renderHeadEntries(
    { teleportHead, assets, content: '', context },
    { hydrate, ...(template === undefined ? {} : { template }) },
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
  result.context ??= {}
  if (request.format === 'json') {
    return {
      format: 'json',
      body: {
        head: renderHeadEntries(result, request, development),
        content: cleanContent(result.content, request.hydrate),
        ...(Object.hasOwn(result.context, 'state') &&
        result.context.state !== undefined
          ? { state: result.context.state }
          : {}),
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
