import {
  defaultTreeAdapter,
  parseFragment,
  serialize,
  serializeOuter,
} from 'parse5'
import type { HeadEntry } from '../index.js'
export type { HeadEntry } from '../index.js'
export type { HeadTag } from '../index.js'

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/** Converts top-level Teleport HTML into structured head entries. */
export function headEntriesFromHtml(html: string): HeadEntry[] {
  const fragment = parseFragment(html)
  const entries: HeadEntry[] = []

  for (const node of fragment.childNodes) {
    if (defaultTreeAdapter.isTextNode(node)) {
      if (node.value.trim()) entries.push({ html: serializeOuter(node) })
      continue
    }

    if (!defaultTreeAdapter.isElementNode(node)) {
      // Preserve Vue's hydration anchors and keep text HTML-encoded.
      entries.push({ html: serializeOuter(node) })
      continue
    }

    const attrs = Object.fromEntries(
      node.attrs.map(({ name, prefix, value }) => [
        prefix ? `${prefix}:${name}` : name,
        value,
      ]),
    )
    const content = serialize(node)
    entries.push({
      tag: node.tagName,
      attrs,
      ...(content ? { content } : {}),
    })
  }

  return entries
}

export function htmlAttributes(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([name, value]) => {
      const escaped = value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
      return ` ${name}="${escaped}"`
    })
    .join('')
}

export function headEntryHtml(entry: HeadEntry): string {
  if ('html' in entry) return entry.html

  const { tag, attrs, content = '' } = entry
  const opening = `<${tag}${htmlAttributes(attrs)}>`
  return voidTags.has(tag) ? opening : `${opening}${content}</${tag}>`
}
