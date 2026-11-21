export const MAX_REQUEST_BYTES = 64 * 1024

export type RenderOutputFormat = 'html' | 'json'

export interface RenderRequest {
  format: RenderOutputFormat
  hydrate: boolean
  template?: string
  context: Record<string, unknown>
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
  options: {
    format?: RenderOutputFormat
    hydrate?: boolean
    template?: string
  } = {},
): RenderRequest {
  if (!isRecord(value)) {
    throw new RenderInputError(
      'The request body must be a JSON object. Send {} with Content-Type: application/json to use an empty context.',
    )
  }

  const format: string = options.format ?? defaultFormat
  const hydrate = options.hydrate ?? false
  const template = options.template

  if (format !== 'html' && format !== 'json') {
    throw new RenderInputError('"format" must be "html" or "json".')
  }

  if (template !== undefined && !template.trim()) {
    throw new RenderInputError(
      'The template query parameter must be a non-empty template name.',
    )
  }
  const request: RenderRequest = { format, hydrate, context: value }
  if (template !== undefined) request.template = template
  return request
}
