import express from 'express'
import type { ErrorRequestHandler } from 'express'

import {
  MAX_REQUEST_BYTES,
  parseRenderRequest,
  RenderInputError,
} from '../render/request.js'
import { renderResponse } from '../render/result.js'
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

interface RenderRouteOptions extends RenderLimits {
  development?: boolean
  interruptible?: boolean
  root?: string
}

function wantsHtmlError(req: express.Request): boolean {
  const requested = req.query.error
  if (requested === 'html') return true
  if (requested === 'json') return false
  return /(?:^|,)\s*text\/html(?:\s*;|\s*,|$)/i.test(req.get('accept') ?? '')
}

function renderErrorHandler({
  development,
  root,
}: Pick<RenderRouteOptions, 'development' | 'root'>): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error)
      return
    }

    const type =
      typeof error === 'object' && error !== null && 'type' in error
        ? error.type
        : undefined
    if (error instanceof RenderBusyError) {
      res.set('Retry-After', '1').status(503).json({ error: error.message })
    } else if (error instanceof RenderTimeoutError) {
      res.status(504).json({ error: error.message })
    } else if (error instanceof RenderInputError) {
      res.status(400).json({ error: error.message })
    } else if (type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: 'Send a valid JSON object, for example {"props":{}}.' })
    } else if (type === 'entity.too.large') {
      res.status(413).json({
        error: 'Request body exceeds 64 KiB. Reduce the JSON payload.',
      })
    } else if (
      type === 'charset.unsupported' ||
      type === 'encoding.unsupported'
    ) {
      res.status(415).json({
        error: 'Unsupported request encoding. Send uncompressed UTF-8 JSON.',
      })
    } else {
      console.error(error)
      if (development && root) {
        void normalizeRenderError(error, root)
          .then((details) => {
            if (wantsHtmlError(req)) {
              res
                .status(500)
                .set({
                  'Cache-Control': 'no-store',
                  'X-Content-Type-Options': 'nosniff',
                })
                .type('html')
                .send(renderErrorPage(details))
              return
            }
            res.status(500).json({ error: details.message, details })
          })
          .catch(next)
        return
      }
      res.status(500).json({
        error:
          'Vue SSR failed. Check the VueForge server log for the component error.',
      })
    }
  }
}

function boundRender(
  render: Render,
  {
    maxConcurrent = MAX_CONCURRENT_RENDERS,
    timeoutMs = RENDER_TIMEOUT_MS,
  }: RenderLimits,
): Render {
  let active = 0

  return async (props, context) => {
    if (active >= maxConcurrent) throw new RenderBusyError()
    active++

    const deadline = performance.now() + timeoutMs
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new RenderTimeoutError())
      }, timeoutMs)
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

export function renderRoute(
  render: Render,
  { interruptible = false, ...options }: RenderRouteOptions = {},
) {
  const renderApi = express.Router()
  const renderRequest = interruptible ? render : boundRender(render, options)

  renderApi.post(
    '/',
    express.json({ inflate: false, limit: MAX_REQUEST_BYTES }),
    async (req, res) => {
      const request = parseRenderRequest(req.body)
      const result = await renderRequest(request.props, request.context)
      res.json(renderResponse(result, request))
    },
  )

  renderApi.use(renderErrorHandler(options))

  return renderApi
}
