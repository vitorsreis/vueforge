import { Buffer } from 'node:buffer'
import { parentPort, workerData } from 'node:worker_threads'

import { MAX_RENDER_BYTES } from './render-capacity.js'
import { renderFrom, type AppRender } from './renderer.js'

export type WorkerRequest = Parameters<AppRender> | undefined
export type WorkerReply =
  | { type: 'ready' }
  | { type: 'rendered'; result: Awaited<ReturnType<AppRender>> }
  | { type: 'error'; detail: string }

if (!parentPort || typeof workerData !== 'string') {
  throw new Error('VueForge could not initialize its SSR worker.')
}

const port = parentPort
const render = renderFrom(await import(workerData))

port.on('message', (request: WorkerRequest) => {
  void renderAndReply(request)
})

async function renderAndReply(request: WorkerRequest) {
  let reply: WorkerReply
  try {
    if (request === undefined) {
      reply = { type: 'ready' }
    } else {
      const { content, teleportHead } = await render(...request)
      if (
        Buffer.byteLength(content) + Buffer.byteLength(teleportHead) >
        MAX_RENDER_BYTES
      ) {
        throw new Error('Vue SSR exceeds the 4 MiB output limit.')
      }
      reply = { type: 'rendered', result: { content, teleportHead } }
    }
  } catch (error) {
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    reply = { type: 'error', detail: detail.slice(0, 4096) }
  }
  port.postMessage(reply)
}
