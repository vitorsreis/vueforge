import {
  MAX_CONCURRENT_RENDERS,
  MAX_RENDER_BYTES,
  RENDER_TIMEOUT_MS,
  RenderBusyError,
  RenderTimeoutError,
  RenderOutputLimitError,
  type RenderLimits,
} from './capacity.js'
import type { Render } from '../../render/renderer.js'
import { normalizeRenderError } from './error.js'
import { renderErrorPage } from './error-page.js'
import { RenderInputError, parseRenderRequest } from '../../render/request.js'
import {
  formatRenderResponse,
  formattedResponseBytes,
} from '../../render/result.js'
import type { RenderOutputFormat } from '../../render/request.js'
import type { DocumentOptions } from '../../render/document.js'
import Negotiator from 'negotiator'

export interface RenderHandlerRequest {
  body: unknown
  accept?: string | undefined
  format?: RenderOutputFormat | undefined
  hydrate?: boolean | undefined
  template?: string | undefined
  errorFormat?: 'html' | 'json' | undefined
}

export interface RenderHandlerResponse {
  status: number
  headers?: Record<string, string>
  body: unknown
}

export interface RenderHandlerOptions extends RenderLimits {
  maxRequestBytes?: number
  defaultFormat?: RenderOutputFormat
  document?: DocumentOptions
  development?: boolean
  interruptible?: boolean
  root?: string
  requireTemplate?: boolean
  templateNames?: readonly string[]
}

function wantsHtmlError({
  accept,
  errorFormat,
}: Pick<RenderHandlerRequest, 'accept' | 'errorFormat'>) {
  if (errorFormat === 'html') return true
  if (errorFormat === 'json') return false
  return /(?:^|,)\s*text\/html(?:\s*;|\s*,|$)/i.test(accept ?? '')
}

function negotiateFormat(
  accept: string | undefined,
  fallback: RenderOutputFormat,
): RenderOutputFormat | undefined {
  if (!accept?.trim()) return fallback
  const selected = new Negotiator({ headers: { accept } }).mediaTypes([
    'application/json',
    'text/html',
  ])
  const mediaType = selected[0]
  if (mediaType === undefined) return undefined
  return mediaType === 'text/html' ? 'html' : 'json'
}

function boundRender(
  render: Render,
  {
    maxConcurrentRenders = MAX_CONCURRENT_RENDERS,
    renderTimeoutMs = RENDER_TIMEOUT_MS,
    maxConcurrent,
    timeoutMs,
  }: RenderLimits,
): Render {
  let active = 0
  const concurrentLimit = maxConcurrent ?? maxConcurrentRenders
  const timeoutLimit = timeoutMs ?? renderTimeoutMs

  return async (context, template) => {
    if (active >= concurrentLimit) throw new RenderBusyError()
    active++

    const deadline = performance.now() + timeoutLimit
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new RenderTimeoutError())
      }, timeoutLimit)
    })
    const rendering = Promise.resolve()
      .then(() => render(context, template))
      .finally(() => {
        active--
      })

    try {
      const result = await Promise.race([rendering, timeout])
      if (performance.now() >= deadline) throw new RenderTimeoutError()
      return result
    } finally {
      clearTimeout(timer)
    }
  }
}

function errorResponse(
  error: unknown,
  request: RenderHandlerRequest,
  options: Pick<RenderHandlerOptions, 'development' | 'root'>,
): Promise<RenderHandlerResponse> {
  if (error instanceof RenderBusyError) {
    return Promise.resolve({
      status: 503,
      headers: {
        'Retry-After': '1',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: { error: error.message },
    })
  }
  if (error instanceof RenderTimeoutError) {
    return Promise.resolve({
      status: 504,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { error: error.message },
    })
  }
  if (error instanceof RenderOutputLimitError) {
    return Promise.resolve({
      status: 413,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { error: error.message },
    })
  }
  if (error instanceof RenderInputError) {
    return Promise.resolve({
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: { error: error.message },
    })
  }

  console.error(error)
  if (options.development && options.root) {
    return normalizeRenderError(error, options.root).then((details) => {
      if (wantsHtmlError(request)) {
        return {
          status: 500,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Type': 'text/html; charset=utf-8',
          },
          body: renderErrorPage(details),
        }
      }
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: { error: details.message, details },
      }
    })
  }

  return Promise.resolve({
    status: 500,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: {
      error:
        'Vue SSR failed. Check the Vueforge server log for the component error.',
    },
  })
}

export function createRenderHandler(
  render: Render,
  {
    interruptible = false,
    defaultFormat = 'json',
    document,
    maxOutputBytes = MAX_RENDER_BYTES,
    ...options
  }: RenderHandlerOptions = {},
) {
  const renderRequest = interruptible ? render : boundRender(render, options)

  return async (
    request: RenderHandlerRequest,
  ): Promise<RenderHandlerResponse> => {
    try {
      const explicitFormat = request.format !== undefined
      const format =
        request.format ?? negotiateFormat(request.accept, defaultFormat)
      if (format === undefined) {
        return {
          status: 406,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Vary: 'Accept',
          },
          body: {
            error: 'Accept must allow application/json or text/html.',
          },
        }
      }
      const parsed = parseRenderRequest(request.body, format, {
        format,
        ...(request.hydrate === undefined ? {} : { hydrate: request.hydrate }),
        ...(request.template === undefined
          ? {}
          : { template: request.template }),
      })
      if (options.requireTemplate && parsed.template === undefined) {
        throw new RenderInputError(
          '"template" is required when a template catalog is configured.',
        )
      }
      if (
        parsed.template !== undefined &&
        options.templateNames !== undefined &&
        !options.templateNames.includes(parsed.template)
      ) {
        throw new RenderInputError(
          `Unknown template "${parsed.template}". Choose one of: ${options.templateNames.join(', ')}.`,
        )
      }
      const result = await renderRequest(parsed.context, parsed.template)
      const formatOptions = {
        ...(document === undefined ? {} : { document }),
        ...(options.development === undefined
          ? {}
          : { development: options.development }),
      }
      const response = formatRenderResponse(result, parsed, formatOptions)
      if (formattedResponseBytes(response) > maxOutputBytes) {
        throw new RenderOutputLimitError(maxOutputBytes)
      }
      return {
        status: 200,
        headers: {
          'Content-Type':
            response.format === 'html'
              ? 'text/html; charset=utf-8'
              : 'application/json; charset=utf-8',
          ...(explicitFormat ? {} : { Vary: 'Accept' }),
        },
        body: response.body,
      }
    } catch (error) {
      return errorResponse(error, request, options)
    }
  }
}
