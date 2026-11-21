import type { VueforgeConfig } from '../../index.js'
import { resolveRenderLimits } from '../../config.js'
import type { AppSources } from '../../config/source.js'

/** Builds the render-handler options shared by HTTP and public render APIs. */
export function createRenderHandlerOptions(
  config: VueforgeConfig,
  limits: ReturnType<typeof resolveRenderLimits>,
  extra: {
    development?: boolean
    interruptible?: boolean
    root?: string
  } = {},
  sources?: AppSources,
) {
  return {
    ...limits,
    defaultFormat: config.format ?? ('json' as const),
    ...(config.document === undefined ? {} : { document: config.document }),
    ...(sources?.kind !== 'templates'
      ? {}
      : {
          requireTemplate: true,
          templateNames: Object.keys(sources.templates),
        }),
    ...extra,
  }
}
