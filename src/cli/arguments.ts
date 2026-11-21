import { parseArgs } from 'node:util'

export type CliCommand = 'serve' | 'build' | 'render'
export type RenderOutputFormat = 'html' | 'json'

export interface CliArguments {
  command?: CliCommand
  config?: string
  dev: boolean
  devSpecified: boolean
  format?: RenderOutputFormat
  hydrate: boolean
  template?: string
  pretty: boolean
  help: boolean
  host?: string
  root?: string
  port?: string
  unix?: string
  stdio: boolean
  shutdownTimeoutMs?: number
  ssl?: { cert?: string; key?: string; ca?: string }
  limits?: {
    maxRequestBytes?: number
    maxOutputBytes?: number
    renderTimeoutMs?: number
    maxConcurrentRenders?: number
  }
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

function positiveInteger(name: string, value: string): number {
  const number = Number(value)
  if (!/^\d+$/.test(value) || number < 1 || !Number.isSafeInteger(number)) {
    throw new CliUsageError(`--${name} must be a positive integer.`)
  }
  return number
}

const serveOptions = [
  'dev',
  'host',
  'port',
  'unix',
  'stdio',
  'ssl-cert',
  'ssl-key',
  'ssl-ca',
  'shutdown-timeout-ms',
  'max-output-bytes',
  'render-timeout-ms',
  'max-concurrent-renders',
] as const

const limitOptions = {
  'max-request-bytes': 'maxRequestBytes',
  'max-output-bytes': 'maxOutputBytes',
  'render-timeout-ms': 'renderTimeoutMs',
  'max-concurrent-renders': 'maxConcurrentRenders',
} as const

export function parseCliArguments(args: string[]): CliArguments {
  let parsed
  try {
    parsed = parseArgs({
      args,
      options: {
        config: { type: 'string', short: 'c' },
        dev: { type: 'boolean' },
        format: { type: 'string', short: 'f' },
        hydrate: { type: 'boolean' },
        template: { type: 'string' },
        pretty: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        host: { type: 'string' },
        root: { type: 'string', short: 'r' },
        port: { type: 'string' },
        unix: { type: 'string' },
        stdio: { type: 'boolean' },
        'ssl-cert': { type: 'string' },
        'ssl-key': { type: 'string' },
        'ssl-ca': { type: 'string' },
        'shutdown-timeout-ms': { type: 'string' },
        'max-request-bytes': { type: 'string' },
        'max-output-bytes': { type: 'string' },
        'render-timeout-ms': { type: 'string' },
        'max-concurrent-renders': { type: 'string' },
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
  const serveOption = serveOptions.find(
    (option) => parsed.values[option] !== undefined,
  )
  if (serveOption !== undefined && selectedCommand !== 'serve') {
    throw new CliUsageError(
      `The --${serveOption} option belongs to the "serve" command.`,
    )
  }

  if (parsed.values.format !== undefined && selectedCommand !== 'render') {
    throw new CliUsageError(
      'The --format option belongs to the "render" command.',
    )
  }
  if (parsed.values.pretty && selectedCommand !== 'render') {
    throw new CliUsageError(
      'The --pretty option belongs to the "render" command.',
    )
  }
  if (parsed.values.hydrate && selectedCommand !== 'render') {
    throw new CliUsageError(
      'The --hydrate option belongs to the "render" command.',
    )
  }
  if (parsed.values.template !== undefined && selectedCommand !== 'render') {
    throw new CliUsageError(
      'The --template option belongs to the "render" command.',
    )
  }

  if (
    parsed.values['max-request-bytes'] !== undefined &&
    selectedCommand !== 'serve' &&
    selectedCommand !== 'render'
  ) {
    throw new CliUsageError(
      'The --max-request-bytes option belongs to the "serve" or "render" command.',
    )
  }
  if (parsed.values.stdio && parsed.values.dev) {
    throw new CliUsageError('The --stdio option cannot be used with --dev.')
  }
  if (parsed.values.stdio && parsed.values.unix !== undefined) {
    throw new CliUsageError(
      'The --stdio and --unix options cannot be used together.',
    )
  }
  if (
    (parsed.values.stdio || parsed.values.unix !== undefined) &&
    (parsed.values.host !== undefined || parsed.values.port !== undefined)
  ) {
    throw new CliUsageError(
      'The --unix and --stdio options cannot be used with --host or --port.',
    )
  }

  const result: CliArguments = {
    dev: parsed.values.dev ?? false,
    devSpecified: parsed.values.dev !== undefined,
    help: parsed.values.help ?? false,
    pretty: parsed.values.pretty ?? false,
    hydrate: parsed.values.hydrate ?? false,
    stdio: parsed.values.stdio ?? false,
    version: parsed.values.version ?? false,
  }

  if (selectedCommand !== undefined) result.command = selectedCommand
  if (parsed.values.config !== undefined) result.config = parsed.values.config
  if (parsed.values.root !== undefined) result.root = parsed.values.root
  if (parsed.values.format !== undefined) {
    const format = outputFormat(parsed.values.format)
    if (format !== undefined) result.format = format
  }
  if (parsed.values.template !== undefined)
    result.template = parsed.values.template
  if (parsed.values.host !== undefined) result.host = parsed.values.host
  if (parsed.values.port !== undefined) result.port = parsed.values.port
  if (parsed.values.unix !== undefined) result.unix = parsed.values.unix
  const {
    'shutdown-timeout-ms': shutdownTimeout,
    'ssl-cert': cert,
    'ssl-key': key,
    'ssl-ca': ca,
  } = parsed.values
  if (shutdownTimeout !== undefined) {
    result.shutdownTimeoutMs = positiveInteger(
      'shutdown-timeout-ms',
      shutdownTimeout,
    )
  }
  if (cert !== undefined || key !== undefined || ca !== undefined) {
    if (parsed.values.stdio) {
      throw new CliUsageError(
        'The --stdio option cannot be used with TLS options.',
      )
    }
    result.ssl = {
      ...(cert === undefined ? {} : { cert }),
      ...(key === undefined ? {} : { key }),
      ...(ca === undefined ? {} : { ca }),
    }
  }
  for (const name of Object.keys(
    limitOptions,
  ) as (keyof typeof limitOptions)[]) {
    const value = parsed.values[name]
    if (value === undefined) continue
    result.limits ??= {}
    result.limits[limitOptions[name]] = positiveInteger(name, value)
  }

  return result
}
