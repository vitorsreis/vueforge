import express from 'express'
import type { ErrorRequestHandler } from 'express'

import type { Render } from './renderer.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

  const type = isRecord(error) ? error.type : undefined
  if (type === 'entity.parse.failed') {
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

  renderApi.post('/', express.json({ limit: '64kb' }), async (req, res) => {
    const body: unknown = req.body

    if (!isRecord(body)) {
      res.status(400).json({
        error:
          'The request body must be a JSON object. Send {} with Content-Type: application/json to use default props.',
      })
      return
    }

    if (body.props !== undefined && !isRecord(body.props)) {
      res.status(400).json({
        error:
          '"props" must be a JSON object, for example {"props":{"title":"Hello"}}.',
      })
      return
    }

    const html = await render(body.props)
    res.json({ html })
  })

  renderApi.use(handleRenderError)

  return renderApi
}
