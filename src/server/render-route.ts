import express from 'express'
import type { ErrorRequestHandler } from 'express'

import { MAX_REQUEST_BYTES } from '../render/request.js'
import {
  createRenderHandler,
  type RenderHandlerOptions,
} from './render-handler.js'
import type { Render } from './renderer.js'

type RenderRouteOptions = RenderHandlerOptions

function renderErrorHandler(): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error)
      return
    }

    const type =
      typeof error === 'object' && error !== null && 'type' in error
        ? error.type
        : undefined
    if (type === 'entity.parse.failed') {
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
    } else next(error)
  }
}

export function renderRoute(
  render: Render,
  { interruptible = false, ...options }: RenderRouteOptions = {},
) {
  const renderApi = express.Router()
  const handleRender = createRenderHandler(render, {
    interruptible,
    ...options,
  })

  renderApi.post(
    '/',
    express.json({
      inflate: false,
      limit: options.maxRequestBytes ?? MAX_REQUEST_BYTES,
    }),
    async (req, res) => {
      const query =
        typeof req.query.error === 'string' ? req.query.error : undefined
      const response = await handleRender({
        body: req.body,
        accept: req.get('accept'),
        errorFormat: query === 'html' || query === 'json' ? query : undefined,
      })
      res.status(response.status).set(response.headers ?? {})
      if (typeof response.body === 'string')
        res.type('html').send(response.body)
      else res.json(response.body)
    },
  )

  renderApi.use(renderErrorHandler())

  return renderApi
}
