import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface RenderErrorDetails {
  name: string
  message: string
  file?: string
  line?: number
  column?: number
  plugin?: string
  frame?: string
  source?: string
  stack?: string
}

interface ErrorRecord {
  cause?: unknown
  column?: unknown
  file?: unknown
  frame?: unknown
  id?: unknown
  line?: unknown
  loc?: unknown
  message?: unknown
  name?: unknown
  plugin?: unknown
  stack?: unknown
}

function record(value: unknown): ErrorRecord {
  if (typeof value === 'object' && value !== null) return value
  return {}
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function position(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined
}

function errorFile(value: string | undefined): string | undefined {
  if (!value) return undefined
  const path = value.split(/[?#]/, 1)[0] ?? value
  if (path.startsWith('file://')) {
    try {
      return fileURLToPath(path)
    } catch {
      return path
    }
  }
  return path
}

function projectFile(
  file: string | undefined,
  root: string,
): string | undefined {
  if (!file) return undefined

  const absolute = isAbsolute(file) ? file : resolve(root, file)
  const path = relative(root, absolute)
  if (path === '' || path === '..' || path.startsWith('..' + sep)) {
    return file.replaceAll('\\', '/')
  }
  return path.replaceAll('\\', '/')
}

async function sourceFrame(
  file: string | undefined,
  line: number | undefined,
  root: string,
): Promise<string | undefined> {
  if (!file || !line) return undefined

  const absolute = isAbsolute(file) ? file : resolve(root, file)
  const path = relative(root, absolute)
  if (path === '..' || path.startsWith('..' + sep)) return undefined

  const content = await readFile(absolute, 'utf8').catch(() => undefined)
  if (content === undefined) return undefined

  const lines = content.split(/\r?\n/)
  const start = Math.max(1, line - 2)
  const end = Math.min(lines.length, line + 2)
  return lines
    .slice(start - 1, end)
    .map((value, index) => {
      const number = start + index
      const marker = number === line ? '>' : ' '
      return `${marker} ${String(number).padStart(4, ' ')} | ${value}`
    })
    .join('\n')
}

/**
 * Converts Vue, Vite, and ordinary thrown values into one development error
 * shape. Source files are read only from the configured project root.
 */
export async function normalizeRenderError(
  thrown: unknown,
  root: string,
): Promise<RenderErrorDetails> {
  const projectRoot = resolve(root)
  const value = record(thrown)
  const cause = record(value.cause)
  const location = record(value.loc)
  const file = projectFile(
    errorFile(text(location.file) ?? text(value.id) ?? text(cause.id)),
    projectRoot,
  )
  const line = position(location.line) ?? position(value.line)
  const column = position(location.column) ?? position(value.column)
  const message =
    text(value.message) ??
    text(cause.message) ??
    (thrown instanceof Error ? thrown.message : String(thrown))

  const details: RenderErrorDetails = {
    name:
      text(value.name) ??
      (thrown instanceof Error ? thrown.name : 'RenderError'),
    message,
  }
  const plugin = text(value.plugin)
  const frame = text(value.frame)
  const stack =
    text(value.stack) ?? (thrown instanceof Error ? thrown.stack : undefined)
  if (file) details.file = file
  if (line) details.line = line
  if (column) details.column = column
  if (plugin) details.plugin = plugin
  if (frame) details.frame = frame
  const source = await sourceFrame(file, line, projectRoot)
  if (source) details.source = source
  if (stack) details.stack = stack
  return details
}

export function errorLocation(error: RenderErrorDetails): string | undefined {
  if (!error.file) return undefined
  return [error.file, error.line, error.column].filter(Boolean).join(':')
}
