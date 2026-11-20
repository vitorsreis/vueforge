export const MAX_REQUEST_BYTES = 64 * 1024

export interface RenderRequest {
  format: 'html' | 'json'
  hydrate: boolean
  props?: Record<string, unknown>
}

export class RenderInputError extends Error {
  override name = 'RenderInputError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseRenderRequest(value: unknown): RenderRequest {
  if (!isRecord(value)) {
    throw new RenderInputError(
      'The request body must be a JSON object. Send {} with Content-Type: application/json to use default props.',
    )
  }

  const { props, format = 'html', hydrate = false } = value
  if (props !== undefined && !isRecord(props)) {
    throw new RenderInputError(
      '"props" must be a JSON object, for example {"props":{"title":"Hello"}}.',
    )
  }

  if (format !== 'html' && format !== 'json') {
    throw new RenderInputError('"format" must be "html" or "json".')
  }

  if (typeof hydrate !== 'boolean') {
    throw new RenderInputError('"hydrate" must be a boolean.')
  }

  return props === undefined ? { format, hydrate } : { format, hydrate, props }
}
