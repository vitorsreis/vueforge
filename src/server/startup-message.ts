import type { VueforgeConfig } from '../index.js'
import type { AppSources } from '../config/source.js'

interface StartupMessageOptions {
  protocol: 'http' | 'https'
  address: string
  mode: 'development' | 'production'
}

function sourceDescription(
  config: VueforgeConfig,
  sources: AppSources,
): string {
  if (sources.kind === 'component') {
    if (sources.template.kind === 'template') return 'with inline SFC main.'
    return `with main component "${sources.template.url.slice(1)}".`
  }
  if (sources.kind === 'entry') {
    return `with main entry "${sources.url.slice(1)}".`
  }
  if (sources.kind === 'factory') return 'with main factory.'

  const main = config.main
  if (typeof main === 'string') {
    return `from directory "${main}".`
  }
  if (main instanceof RegExp) {
    return `from pattern "${String(main)}".`
  }
  const count = Object.keys(sources.templates).length
  return `with named template catalog (${String(count)} ${count === 1 ? 'template' : 'templates'}).`
}

export function formatStartupMessage(
  options: StartupMessageOptions,
  config: VueforgeConfig,
  sources: AppSources,
): string {
  const description = sourceDescription(config, sources)
  return `Vueforge listening on ${options.protocol}://${options.address} in ${options.mode} mode ${description}`
}
