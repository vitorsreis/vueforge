import { Buffer } from 'node:buffer'
import { TextDecoder } from 'node:util'

import { MAX_REQUEST_BYTES } from '../render/request.js'

export class HttpRenderInputError extends Error {
  override name = 'HttpRenderInputError'
  readonly status: 400 | 413 | 415

  constructor(status: 400 | 413 | 415, message: string) {
    super(message)
    this.status = status
  }
}

function validateHeaders(contentType?: string, contentEncoding?: string) {
  if (
    contentType === undefined ||
    !/^application\/(?:json|[^;]+\+json)\b/i.test(contentType)
  ) {
    throw new HttpRenderInputError(
      415,
      'Content-Type must be application/json.',
    )
  }
  const charset = /(?:^|;)\s*charset=([^;]+)/i.exec(contentType)?.[1]
  if (charset !== undefined && charset.trim().toLowerCase() !== 'utf-8') {
    throw new HttpRenderInputError(
      415,
      'Unsupported request encoding. Send UTF-8 JSON.',
    )
  }
  if (
    contentEncoding !== undefined &&
    contentEncoding.toLowerCase() !== 'identity'
  ) {
    throw new HttpRenderInputError(
      415,
      'Unsupported request encoding. Send uncompressed UTF-8 JSON.',
    )
  }
}

/** Reads and parses one bounded UTF-8 JSON request for native HTTP adapters. */
export async function readJsonRequestBody(
  body: AsyncIterable<Uint8Array>,
  {
    contentType,
    contentEncoding,
    maxBytes = MAX_REQUEST_BYTES,
  }: {
    contentType?: string
    contentEncoding?: string
    maxBytes?: number
  } = {},
): Promise<unknown> {
  validateHeaders(contentType, contentEncoding)
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of body) {
    size += chunk.byteLength
    if (size > maxBytes) {
      throw new HttpRenderInputError(
        413,
        `Request body exceeds ${String(maxBytes)} bytes. Reduce the JSON payload.`,
      )
    }
    chunks.push(chunk)
  }

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(
        chunks.map((chunk) => Buffer.from(chunk)),
        size,
      ),
    )
  } catch {
    throw new HttpRenderInputError(
      415,
      'Unsupported request encoding. Send UTF-8 JSON.',
    )
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new HttpRenderInputError(
      400,
      'Send a valid JSON object, for example {"props":{}}.',
    )
  }
}
