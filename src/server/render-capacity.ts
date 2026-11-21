export class RenderBusyError extends Error {
  override name = 'RenderBusyError'

  constructor() {
    super('All Vue SSR slots are busy. Retry shortly.')
  }
}

export class RenderTimeoutError extends Error {
  override name = 'RenderTimeoutError'

  constructor() {
    super('Vue SSR timed out.')
  }
}

export class RenderOutputLimitError extends Error {
  override name = 'RenderOutputLimitError'

  constructor(limit: number) {
    super(`Vue SSR response exceeds the ${String(limit)} byte output limit.`)
  }
}

export const MAX_CONCURRENT_RENDERS = 4
export const RENDER_TIMEOUT_MS = 5000
export const MAX_RENDER_BYTES = 4 * 1024 * 1024

export interface RenderLimits {
  maxConcurrentRenders?: number
  renderTimeoutMs?: number
  maxOutputBytes?: number
  maxConcurrent?: number
  timeoutMs?: number
}
