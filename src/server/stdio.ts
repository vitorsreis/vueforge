import { Buffer } from 'node:buffer'
import type { Readable, Writable } from 'node:stream'
import { TextDecoder } from 'node:util'

import { MAX_REQUEST_BYTES } from '../render/request.js'

export interface StdioOptions {
  handle: (body: unknown) => Promise<unknown>
  input?: Readable
  output?: Writable
  maxRequestBytes?: number
  signal?: AbortSignal
}

export class StdioInputError extends Error {
  override name = 'StdioInputError'
}

type StdioLine = { value: string } | { error: string }
const decoder = new TextDecoder('utf-8', { fatal: true })

async function* lines(
  input: Readable,
  maxBytes: number,
): AsyncGenerator<StdioLine> {
  const pending: Buffer[] = []
  let size = 0
  let oversized = false

  for await (const chunk of input as AsyncIterable<Buffer | string>) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    let offset = 0

    while (offset < bytes.length) {
      const newline = bytes.indexOf(0x0a, offset)
      const end = newline === -1 ? bytes.length : newline

      if (!oversized) {
        const part = bytes.subarray(offset, end)
        size += part.length
        if (size > maxBytes) {
          oversized = true
          pending.length = 0
        } else if (part.length > 0) {
          pending.push(part)
        }
      }

      if (newline === -1) break

      if (oversized) {
        yield {
          error: `Request line exceeds ${String(maxBytes)} bytes.`,
        }
      } else {
        const value =
          pending.length === 1
            ? (pending[0] ?? Buffer.alloc(0))
            : Buffer.concat(pending, size)
        yield decodeLine(value)
      }

      pending.length = 0
      size = 0
      oversized = false
      offset = newline + 1
    }
  }

  if (oversized) {
    yield { error: `Request line exceeds ${String(maxBytes)} bytes.` }
  } else if (size > 0) {
    yield decodeLine(Buffer.concat(pending, size))
  }
}

function decodeLine(value: Buffer): StdioLine {
  const line = value[value.length - 1] === 0x0d ? value.subarray(0, -1) : value
  try {
    return {
      value: decoder.decode(line),
    }
  } catch {
    return { error: 'Unsupported request encoding. Send UTF-8 JSON.' }
  }
}

async function writeLine(output: Writable, value: unknown): Promise<void> {
  const line = JSON.stringify(value) + '\n'
  await new Promise<void>((resolve, reject) => {
    output.once('error', reject)
    output.write(line, (error) => {
      if (error) {
        // Writable emits the same failure after invoking the write callback.
        setImmediate(() => output.off('error', reject))
        reject(error)
        return
      }
      output.off('error', reject)
      resolve()
    })
  })
}

/**
 * Processes newline-delimited JSON requests until the input closes.
 * The output stream is reserved for protocol responses. Project diagnostics
 * must be redirected to stderr by the caller.
 */
export async function serveStdio({
  handle,
  input = process.stdin,
  output = process.stdout,
  maxRequestBytes = MAX_REQUEST_BYTES,
  signal,
}: StdioOptions): Promise<void> {
  if (!Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 1) {
    throw new StdioInputError(
      'The stdio request limit must be a positive integer.',
    )
  }

  if (signal?.aborted) return
  const stop = () => {
    input.destroy()
  }
  signal?.addEventListener('abort', stop, { once: true })

  try {
    for await (const line of lines(input, maxRequestBytes)) {
      if (signal?.aborted) break

      if ('error' in line) {
        await writeLine(output, { error: line.error })
        continue
      }

      if (!line.value.trim()) continue

      let body: unknown
      try {
        body = JSON.parse(line.value) as unknown
      } catch {
        await writeLine(output, {
          error: 'Send one valid JSON request per line.',
        })
        continue
      }

      await writeLine(output, await handle(body))
    }
  } catch (error) {
    if (!signal?.aborted) throw error
  } finally {
    signal?.removeEventListener('abort', stop)
  }
}
