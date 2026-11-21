import { parseArgs } from 'node:util'

export type CliCommand = 'serve' | 'build' | 'render'
export type RenderOutputFormat = 'html' | 'json'

export interface CliArguments {
  command?: CliCommand
  config?: string
  dev: boolean
  format?: RenderOutputFormat
  help: boolean
  host?: string
  port?: string
  version: boolean
}

export class CliUsageError extends Error {
  override name = 'CliUsageError'
  readonly exitCode = 2
}

const commands = new Set<CliCommand>(['serve', 'build', 'render'])

function command(value: string | undefined): CliCommand | undefined {
  if (value === undefined) return undefined
  if (commands.has(value as CliCommand)) return value as CliCommand
  throw new CliUsageError(`Unknown command "${value}".`)
}

function outputFormat(
  value: string | undefined,
): RenderOutputFormat | undefined {
  if (value === undefined) return undefined
  if (value === 'html' || value === 'json') return value
  throw new CliUsageError('--format must be "html" or "json".')
}

export function parseCliArguments(args: string[]): CliArguments {
  let parsed
  try {
    parsed = parseArgs({
      args,
      options: {
        config: { type: 'string', short: 'c' },
        dev: { type: 'boolean' },
        format: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
        host: { type: 'string' },
        port: { type: 'string' },
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
      strict: true,
    })
  } catch (error) {
    throw new CliUsageError(
      error instanceof Error ? error.message : String(error),
    )
  }

  if (parsed.positionals.length > 1) {
    const unexpected = parsed.positionals[1] ?? ''
    throw new CliUsageError(`Unexpected argument "${unexpected}".`)
  }

  const selectedCommand = command(parsed.positionals[0])
  const usesServeOption =
    parsed.values.dev !== undefined ||
    parsed.values.host !== undefined ||
    parsed.values.port !== undefined

  if (usesServeOption && selectedCommand !== 'serve') {
    throw new CliUsageError(
      'The --dev, --host and --port options belong to the "serve" command.',
    )
  }

  if (parsed.values.format !== undefined && selectedCommand !== 'render') {
    throw new CliUsageError(
      'The --format option belongs to the "render" command.',
    )
  }

  const result: CliArguments = {
    dev: parsed.values.dev ?? false,
    help: parsed.values.help ?? false,
    version: parsed.values.version ?? false,
  }

  if (selectedCommand !== undefined) result.command = selectedCommand
  if (parsed.values.config !== undefined) result.config = parsed.values.config
  if (parsed.values.format !== undefined) {
    const format = outputFormat(parsed.values.format)
    if (format !== undefined) result.format = format
  }
  if (parsed.values.host !== undefined) result.host = parsed.values.host
  if (parsed.values.port !== undefined) result.port = parsed.values.port

  return result
}
