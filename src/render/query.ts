const trueValues = new Set(['on', '1', 'true', 'yes'])
const falseValues = new Set(['off', '0', 'false'])

/** Parses a protocol boolean from a raw query string. */
export function queryBoolean(url: string | undefined, name: string): boolean {
  if (!url) return false
  const query = url.split('?', 2)[1]?.split('#', 1)[0]
  if (query === undefined) return false

  for (const part of query.split('&')) {
    const separator = part.indexOf('=')
    const key = separator === -1 ? part : part.slice(0, separator)
    if (decodeURIComponent(key.replaceAll('+', ' ')) !== name) continue
    if (separator === -1) return true
    const raw = decodeURIComponent(
      part.slice(separator + 1).replaceAll('+', ' '),
    )
      .trim()
      .toLowerCase()
    if (trueValues.has(raw)) return true
    if (falseValues.has(raw)) return false
    return false
  }
  return false
}

/** Reads a string protocol parameter from a raw query string. */
export function queryValue(
  url: string | undefined,
  name: string,
): string | undefined {
  if (!url) return undefined
  const query = url.split('?', 2)[1]?.split('#', 1)[0]
  if (query === undefined) return undefined
  for (const part of query.split('&')) {
    const separator = part.indexOf('=')
    const key = separator === -1 ? part : part.slice(0, separator)
    if (decodeURIComponent(key.replaceAll('+', ' ')) !== name) continue
    if (separator === -1) return ''
    return decodeURIComponent(part.slice(separator + 1).replaceAll('+', ' '))
  }
  return undefined
}
