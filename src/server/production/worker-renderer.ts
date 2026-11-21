import { Worker } from 'node:worker_threads'

import type { WorkerReply, WorkerRequest } from './worker.js'
import {
  MAX_CONCURRENT_RENDERS,
  MAX_RENDER_BYTES,
  RENDER_TIMEOUT_MS,
  RenderBusyError,
  RenderTimeoutError,
  type RenderLimits,
} from '../render/capacity.js'
import type { AppRender } from '../../render/renderer.js'

interface Slot {
  worker: Worker
  busy: boolean
  termination?: Promise<number>
}

function stop(slot: Slot) {
  slot.termination ??= slot.worker.terminate()
  return slot.termination
}

export async function productionWorkerRenderer(
  entry: URL,
  {
    maxConcurrentRenders,
    renderTimeoutMs,
    maxOutputBytes = MAX_RENDER_BYTES,
    maxConcurrent,
    timeoutMs,
  }: RenderLimits = {},
) {
  const concurrentLimit =
    maxConcurrentRenders ?? maxConcurrent ?? MAX_CONCURRENT_RENDERS
  const timeoutLimit = renderTimeoutMs ?? timeoutMs ?? RENDER_TIMEOUT_MS
  const slots = new Set<Slot>()
  let closed = false

  function start() {
    const worker = new Worker(new URL('./worker.js', import.meta.url), {
      workerData: { entry: entry.href, maxOutputBytes },
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 16,
      },
    })
    const slot: Slot = { worker, busy: false }
    slots.add(slot)
    worker.once('exit', () => slots.delete(slot))
    worker.on('error', (error) => {
      if (!slot.busy) console.error(error)
    })
    return slot
  }

  async function ask(slot: Slot, request: WorkerRequest) {
    const { worker } = slot
    slot.busy = true
    worker.ref()

    const { promise, resolve, reject } = Promise.withResolvers<WorkerReply>()
    const deadline = performance.now() + timeoutLimit
    const expire = () => {
      void stop(slot)
      reject(new RenderTimeoutError())
    }
    const onMessage = (message: WorkerReply) => {
      if (performance.now() >= deadline) expire()
      else resolve(message)
    }
    const onExit = (code: number) => {
      reject(new Error(`Vueforge SSR worker exited with code ${String(code)}.`))
    }
    const timer = setTimeout(expire, timeoutLimit)
    worker.once('message', onMessage)
    worker.once('error', reject)
    worker.once('exit', onExit)

    try {
      worker.postMessage(request)
      return await promise
    } finally {
      clearTimeout(timer)
      worker.off('message', onMessage)
      worker.off('error', reject)
      worker.off('exit', onExit)
      slot.busy = false
      worker.unref()
    }
  }

  async function close() {
    closed = true
    await Promise.all([...slots].map(stop))
  }

  try {
    await ask(start(), undefined)
  } catch (error) {
    await close()
    throw error
  }

  const render: AppRender = async (props, context, template) => {
    if (closed) throw new RenderBusyError()
    const idle = [...slots].find(
      ({ busy, termination }) => !busy && !termination,
    )
    const slot = idle ?? (slots.size < concurrentLimit ? start() : undefined)
    if (!slot) throw new RenderBusyError()

    const reply = await ask(slot, [props, context, template])
    if (reply.type === 'error') throw new Error(reply.detail)
    if (reply.type !== 'rendered')
      throw new Error('Unexpected Vueforge SSR worker response.')
    return reply.result
  }

  return { render, close }
}
