import type { CliCommand } from './arguments.js'

const globalOptions = `Options:
  -r, --root <path>     Project root (default: current directory)
  -c, --config <path>  Configuration file (default: vueforge.config.ts)
  -h, --help           Show help
  -v, --version        Show version`

const commandOptions = `Global options:
  -r, --root <path>     Project root
  -c, --config <path>  Configuration file
  -h, --help           Show help
  -v, --version        Show version`

export function cliHelp(command?: CliCommand): string {
  if (command === 'serve') {
    return `Usage: vueforge serve [options]

Start the Vueforge HTTP server.

Options:
  --dev                Use Vite development SSR and HMR
  --host <host>        Bind hostname or IP address
  --port <port>        Bind TCP port
  --unix <path>        Listen on a Unix socket
  --stdio              Read newline-delimited JSON from standard input
  --ssl-cert <path>    TLS certificate file
  --ssl-key <path>     TLS private key file
  --ssl-ca <path>      TLS CA file
  --shutdown-timeout-ms <ms>
                       Graceful shutdown timeout (positive integer)
  --max-request-bytes <bytes>
                       Maximum request body size (positive integer)
  --max-output-bytes <bytes>
                       Maximum rendered output size (positive integer)
  --render-timeout-ms <ms>
                       Maximum render duration (positive integer)
  --max-concurrent-renders <count>
                       Maximum concurrent renders (positive integer)
  -r, --root <path>     Project root
  -c, --config <path>  Configuration file
  -h, --help           Show this help
  -v, --version        Show version

Examples:
  vueforge serve --dev
  vueforge serve --host 0.0.0.0 --port 9901`
  }

  if (command === 'build') {
    return `Usage: vueforge build [options]

Build the browser and server artifacts.

${commandOptions}

Examples:
  vueforge build
  vueforge build --config config/vueforge.ts`
  }

  if (command === 'render') {
    return `Usage: vueforge render [options]

Render one request from standard input using the production build.

Options:
  -f, --format <format> Output format: json (default) or html
  --pretty              Indent JSON output
  --max-request-bytes <bytes>
                       Maximum request body size (positive integer)
  -r, --root <path>     Project root
  -c, --config <path>  Configuration file
  -h, --help           Show this help
  -v, --version        Show version

Input:
  Send one JSON object through standard input. The request may include props,
  context, format, and hydrate.

Examples:
  echo '{"props":{"title":"Hello"}}' | vueforge render
  vueforge render --format html < request.json`
  }

  return `vueforge - Vue SSR renderer for any backend

Usage: vueforge <command> [options]

Commands:
  serve     Start the HTTP renderer
  build     Build production artifacts
  render    Render one request from standard input

${globalOptions}

Examples:
  vueforge serve --dev
  vueforge build
  echo '{"props":{"title":"Hello"}}' | vueforge render

Run "vueforge <command> --help" for command-specific options.`
}
