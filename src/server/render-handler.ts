import {
  MAX_CONCURRENT_RENDERS,
  RENDER_TIMEOUT_MS,
  RenderBusyError,
  RenderTimeoutError,
  type RenderLimits,
} from './render-capacity.js'
import type { Render } from './renderer.js'
import { normalizeRenderError } from './render-error.js'
import { renderErrorPage } from './render-error-page.js'
import { RenderInputError, parseRenderRequest } from '../render/request.js'
import { formatRenderResponse } from '../render/result.js'
import type { RenderOutputFormat } from '../render/request.js'
import type { DocumentOptions } from '../render/document.js'
import Negotiator from 'negotiator'

export interface RenderHandlerRequest {
  body: unknown
  accept?: string | undefined
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

function hasExplicitFormat(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, 'format')
  )
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

  return async (props, context) => {
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
      .then(() => render(props, context))
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
        'Vue SSR failed. Check the VueForge server log for the component error.',
    },
  })
}

export function createRenderHandler(
  render: Render,
  {
    interruptible = false,
    defaultFormat = 'json',
    document,
    ...options
  }: RenderHandlerOptions = {},
) {
  const renderRequest = interruptible ? render : boundRender(render, options)

  return async (
    request: RenderHandlerRequest,
  ): Promise<RenderHandlerResponse> => {
    try {
      const parsed = parseRenderRequest(request.body)
      const explicitFormat = hasExplicitFormat(request.body)
      const format = explicitFormat
        ? undefined
        : negotiateFormat(request.accept, defaultFormat)
      if (!explicitFormat && format === undefined) {
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
      const input =
        explicitFormat || format === undefined ? parsed : { ...parsed, format }
      const result = await renderRequest(input.props, input.context)
      const formatOptions = {
        ...(document === undefined ? {} : { document }),
        ...(options.development === undefined
          ? {}
          : { development: options.development }),
      }
      const response = formatRenderResponse(result, input, formatOptions)
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
