import { Buffer } from 'node:buffer'
import process from 'node:process'
import { TextDecoder } from 'node:util'

import { loadProjectConfig, resolveTempDir } from '../config.js'
import { MAX_REQUEST_BYTES, parseRenderRequest } from '../render/request.js'
import { renderResponse } from '../render/result.js'
import { productionRenderer } from '../server/production.js'

async function readRequest(): Promise<unknown> {
  if (process.stdin.isTTY) return {}

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_REQUEST_BYTES) {
      throw new Error('Request body exceeds 64 KiB. Reduce the JSON payload.')
    }
    chunks.push(chunk)
  }

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(chunks, size),
    )
  } catch {
    throw new Error('Unsupported request encoding. Send UTF-8 JSON.')
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Send a valid JSON object, for example {"props":{}}.')
  }
}

export async function renderProject(root: string) {
  // Keep stdout for the response even if project code logs after rendering.
  const writeResponse = process.stdout.write.bind(process.stdout)
  process.stdout.write = process.stderr.write.bind(process.stderr)

  const request = parseRenderRequest(await readRequest())
  const config = await loadProjectConfig(root, {
    command: 'serve',
    mode: 'production',
  })
  const { render } = await productionRenderer(
    resolveTempDir(root, config.tempDir),
  )
  const response = renderResponse(
    await render(request.props, request.context),
    request,
  )
  writeResponse(JSON.stringify(response) + '\n')
}
