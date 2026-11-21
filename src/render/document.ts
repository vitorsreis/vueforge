import { headEntryHtml, htmlAttributes } from './head.js'
import type { HeadEntry, DocumentOptions } from '../index.js'

export type { DocumentOptions } from '../index.js'

/** Builds the complete HTML document used by CLI and document adapters. */
export function renderDocument(
  head: string | HeadEntry[],
  content: string,
  options: DocumentOptions = {},
): string {
  const doctype = options.doctype ?? '<!doctype html>'
  const rootId = options.rootId ?? 'app'
  const headHtml = [
    ...(options.head ?? []),
    ...(typeof head === 'string' ? [{ html: head }] : head),
  ]
    .map(headEntryHtml)
    .join('')

  return `${doctype}
<html${htmlAttributes(options.htmlAttrs ?? {})}>
  <head>${headHtml}</head>
  <body${htmlAttributes(options.bodyAttrs ?? {})}>
    <div${htmlAttributes({ id: rootId })}>${content}</div>
  </body>
</html>
`
}
