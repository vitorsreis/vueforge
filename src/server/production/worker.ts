import { Buffer } from 'node:buffer'
import { serialize } from 'node:v8'
import { parentPort, workerData } from 'node:worker_threads'

import { renderFrom, type AppRender } from '../../render/renderer.js'

export type WorkerRequest = Parameters<AppRender> | undefined
export type WorkerReply =
  | { type: 'ready' }
  | { type: 'rendered'; result: Awaited<ReturnType<AppRender>> }
  | { type: 'error'; detail: string }

interface WorkerOptions {
  entry?: unknown
  maxOutputBytes?: unknown
}

const options =
  typeof workerData === 'object' && workerData !== null
    ? (workerData as WorkerOptions)
    : {}
const maxOutputBytes = Number(options.maxOutputBytes)

if (
  !parentPort ||
  typeof options.entry !== 'string' ||
  !Number.isSafeInteger(maxOutputBytes) ||
  maxOutputBytes < 1
) {
  throw new Error('Vueforge could not initialize its SSR worker.')
}

const port = parentPort
const entry = options.entry
const render = renderFrom(await import(entry))

port.on('message', (request: WorkerRequest) => {
  void renderAndReply(request)
})

async function renderAndReply(request: WorkerRequest) {
  let reply: WorkerReply
  try {
    if (request === undefined) {
      reply = { type: 'ready' }
    } else {
      const { content, teleportHead, context } = await render(...request)
      if (
        Buffer.byteLength(content) +
          Buffer.byteLength(teleportHead) +
          serialize(context).byteLength >
        maxOutputBytes
      ) {
        throw new Error(
          `Vue SSR exceeds the ${String(maxOutputBytes)} byte output limit.`,
        )
      }
      reply = { type: 'rendered', result: { content, teleportHead, context } }
    }
  } catch (error) {
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    reply = { type: 'error', detail: detail.slice(0, 4096) }
  }
  port.postMessage(reply)
}
