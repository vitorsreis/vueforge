export const MAX_REQUEST_BYTES = 64 * 1024

export type RenderOutputFormat = 'html' | 'json'

export interface RenderRequest {
  format: RenderOutputFormat
  hydrate: boolean
  props?: Record<string, unknown>
  context?: Record<string, unknown>
}

export class RenderInputError extends Error {
  override name = 'RenderInputError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseRenderRequest(
  value: unknown,
  defaultFormat: RenderOutputFormat = 'json',
): RenderRequest {
  if (!isRecord(value)) {
    throw new RenderInputError(
      'The request body must be a JSON object. Send {} with Content-Type: application/json to use default props.',
    )
  }

  const { props, context, format = defaultFormat, hydrate = false } = value
  if (props !== undefined && !isRecord(props)) {
    throw new RenderInputError(
      '"props" must be a JSON object, for example {"props":{"title":"Hello"}}.',
    )
  }

  if (context !== undefined && !isRecord(context)) {
    throw new RenderInputError('"context" must be a JSON object.')
  }

  if (format !== 'html' && format !== 'json') {
    throw new RenderInputError('"format" must be "html" or "json".')
  }

  if (typeof hydrate !== 'boolean') {
    throw new RenderInputError('"hydrate" must be a boolean.')
  }

  const request: RenderRequest = { format, hydrate }
  if (props !== undefined) request.props = props
  if (context !== undefined) request.context = context
  return request
}
