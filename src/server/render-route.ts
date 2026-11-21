import express from 'express'
import type { ErrorRequestHandler } from 'express'

import {
  MAX_REQUEST_BYTES,
  parseRenderRequest,
  RenderInputError,
} from '../render/request.js'
import { renderResponse } from '../render/result.js'
import type { Render } from './renderer.js'

const handleRenderError: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error)
    return
  }

  const type =
    typeof error === 'object' && error !== null && 'type' in error
      ? error.type
      : undefined
  if (error instanceof RenderInputError) {
    res.status(400).json({ error: error.message })
  } else if (type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: 'Send a valid JSON object, for example {"props":{}}.' })
  } else if (type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: 'Request body exceeds 64 KiB. Reduce the JSON payload.' })
  } else if (
    type === 'charset.unsupported' ||
    type === 'encoding.unsupported'
  ) {
    res.status(415).json({
      error: 'Unsupported request encoding. Send uncompressed UTF-8 JSON.',
    })
  } else {
    console.error(error)
    res.status(500).json({
      error:
        'Vue SSR failed. Check the VueForge server log for the component error.',
    })
  }
}

export function renderRoute(render: Render) {
  const renderApi = express.Router()

  renderApi.post(
    '/',
    express.json({ limit: MAX_REQUEST_BYTES }),
    async (req, res) => {
      const request = parseRenderRequest(req.body)
      const result = await render(request.props, request.context)
      res.json(renderResponse(result, request))
    },
  )

  renderApi.use(handleRenderError)

  return renderApi
}
