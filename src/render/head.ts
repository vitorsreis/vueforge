export interface HeadTag {
  tag: 'link' | 'script' | 'style'
  attrs: Record<string, string>
  content?: string
}

export type HeadEntry = HeadTag | { html: string }

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function headEntryHtml(entry: HeadEntry): string {
  if ('html' in entry) return entry.html

  const { tag, attrs, content = '' } = entry
  const attributes = Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('')
  const opening = `<${tag}${attributes}>`
  return tag === 'link' ? opening : `${opening}${content}</${tag}>`
}
