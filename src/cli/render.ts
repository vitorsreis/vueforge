import { Buffer } from 'node:buffer'
import process from 'node:process'
import { TextDecoder } from 'node:util'

import {
  loadProjectConfig,
  resolveBuildOutputDir,
  resolveAssetBase,
  resolveRenderLimits,
  resolveAppSources,
} from '../config.js'
import { parseRenderRequest } from '../render/request.js'
import {
  formatRenderResponse,
  formattedResponseBytes,
} from '../render/result.js'
import { productionRenderer } from '../server/production/renderer.js'
import type { VueforgeConfig } from '../index.js'

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
      throw new Error(`Request body exceeds ${limit}. Reduce the JSON payload.`)
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
    throw new Error('Send a valid JSON context object, for example {}.')
  }
}

export async function renderProject(
  root: string,
  outputFormat?: 'html' | 'json',
  configFile?: string,
  limitsOverride?: VueforgeConfig['limits'],
  pretty = false,
  hydrate = false,
  template?: string,
) {
  const writeResponse = process.stdout.write.bind(process.stdout)
  process.stdout.write = process.stderr.write.bind(process.stderr)

  const config = await loadProjectConfig(
    root,
    { command: 'serve', mode: 'production' },
    configFile,
    undefined,
    undefined,
    'production',
  )
  const projectRoot = config.root ?? root
  if (limitsOverride !== undefined)
    config.limits = { ...config.limits, ...limitsOverride }
  const limits = resolveRenderLimits(config)
  const sources =
    config.main === undefined
      ? undefined
      : await resolveAppSources(projectRoot, config)
  const request = parseRenderRequest(
    await readRequest(limits.maxRequestBytes),
    config.format ?? 'json',
    {
      ...(outputFormat === undefined ? {} : { format: outputFormat }),
      ...(hydrate ? { hydrate: true } : {}),
      ...(template === undefined ? {} : { template }),
    },
  )
  const { render } = await productionRenderer(
    resolveBuildOutputDir(projectRoot, config.build?.outDir),
    resolveAssetBase(config.origin, config.base),
  )

  if (sources?.kind === 'templates' && request.template === undefined) {
    throw new Error(
      '"template" is required when a template catalog is configured.',
    )
  }
  if (
    request.template !== undefined &&
    sources?.kind === 'templates' &&
    !Object.hasOwn(sources.templates, request.template)
  ) {
    throw new Error(`Unknown template "${request.template}".`)
  }
  const rendered = await render(request.context, request.template)
  const response = formatRenderResponse(
    rendered,
    request,
    config.document === undefined ? {} : { document: config.document },
  )
  if (formattedResponseBytes(response) > limits.maxOutputBytes) {
    throw new Error(
      `Vue SSR response exceeds the ${String(limits.maxOutputBytes)} byte output limit.`,
    )
  }
  writeResponse(
    response.format === 'html'
      ? response.body
      : JSON.stringify(response.body, null, pretty ? 2 : undefined) + '\n',
  )
}
