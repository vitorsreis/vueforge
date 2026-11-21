import { Buffer } from 'node:buffer'
import process from 'node:process'
import { TextDecoder } from 'node:util'

import {
  loadProjectConfig,
  resolveBuildOutputDir,
  resolveRenderLimits,
} from '../config.js'
import { parseRenderRequest } from '../render/request.js'
import { formatRenderResponse } from '../render/result.js'
import { productionRenderer } from '../server/production.js'

async function readRequest(maxRequestBytes: number): Promise<unknown> {
  if (process.stdin.isTTY) return {}

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > maxRequestBytes) {
      const limit =
        maxRequestBytes === 64 * 1024
          ? '64 KiB'
          : `${String(maxRequestBytes)} bytes`
      throw new Error(
        `Request body exceeds ${limit}. Reduce the JSON payload.`,
      )
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

export async function renderProject(
  root: string,
  outputFormat?: 'html' | 'json',
  configFile?: string,
  limitsOverride?: { maxRequestBytes?: number },
) {
  // Keep stdout for the response even if project code logs after rendering.
  const writeResponse = process.stdout.write.bind(process.stdout)
  process.stdout.write = process.stderr.write.bind(process.stderr)

  const config = await loadProjectConfig(
    root,
    { command: 'serve', mode: 'production' },
    configFile,
  )
  if (limitsOverride !== undefined)
    config.limits = { ...config.limits, ...limitsOverride }
  const limits = resolveRenderLimits(config)
  const request = parseRenderRequest(
    await readRequest(limits.maxRequestBytes),
    config.format ?? 'json',
  )
  const { render } = await productionRenderer(
    resolveBuildOutputDir(root, config.build?.outDir),
  )

  const rendered = await render(request.props, request.context)
  const response = formatRenderResponse(
    rendered,
    outputFormat === undefined ? request : { ...request, format: outputFormat },
    config.document === undefined ? {} : { document: config.document },
  )
  writeResponse(
    response.format === 'html'
      ? response.body
      : JSON.stringify(response.body) + '\n',
  )
}
