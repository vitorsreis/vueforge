const trueValues = new Set(['on', '1', 'true', 'yes'])
const falseValues = new Set(['off', '0', 'false'])

function decode(value: string): string | undefined {
  try {
    return decodeURIComponent(value.replaceAll('+', ' '))
  } catch {
    return undefined
  }
}

/** Parses a protocol boolean from a raw query string. */
export function queryBoolean(url: string | undefined, name: string): boolean {
  if (!url) return false
  const query = url.split('?', 2)[1]?.split('#', 1)[0]
  if (query === undefined) return false

  for (const part of query.split('&')) {
    const separator = part.indexOf('=')
    const key = separator === -1 ? part : part.slice(0, separator)
    if (decode(key) !== name) continue
    if (separator === -1) return true
    const raw = decode(part.slice(separator + 1))
    if (raw === undefined) return false
    const normalized = raw.trim().toLowerCase()
    if (trueValues.has(normalized)) return true
    if (falseValues.has(normalized)) return false
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
    if (decode(key) !== name) continue
    if (separator === -1) return ''
    return decode(part.slice(separator + 1))
  }
  return undefined
}
