import { resolve } from 'node:path'

import {
  loadProjectConfig,
  resolveAppSources,
  resolveAssetBase,
  resolveBuildOutputDir,
  resolveRenderLimits,
} from './config.js'
import type { HeadEntry, VueforgeConfig } from './index.js'
import { createRenderHandler } from './server/render/handler.js'
import { createRenderHandlerOptions } from './server/render/handler-options.js'
import { developmentRenderer } from './server/development.js'
import { productionRenderer } from './server/production/renderer.js'
import { productionWorkerRenderer } from './server/production/worker-renderer.js'
import type { RenderOutputFormat } from './render/request.js'

/** Runtime mode used by a public Vueforge renderer. */
export type VueforgeRendererMode = 'development' | 'production'

/** Options used to initialize a public Vueforge renderer. */
export interface VueforgeRendererOptions {
  /** Project directory. Defaults to the current working directory. */
  root?: string
  /** Runtime mode. Defaults to `production`. */
  mode?: VueforgeRendererMode
  /** Configuration file relative to `root`. */
  configFile?: string
}

/** Request passed to a public Vueforge renderer. */
export interface VueforgeRenderRequest {
  /** Complete request context passed to the Vue application. */
  context: Record<string, unknown>
  /** Named catalog entry selected for this render. */
  template?: string
  /** Desired response representation. */
  format?: RenderOutputFormat
  /** Include hydration data and browser assets. */
  hydrate?: boolean
  /** Accept header used when `format` is omitted. */
  accept?: string
  /** Error representation used for development failures. */
  errorFormat?: 'html' | 'json'
}

/** JSON body returned by a successful public render. */
export interface VueforgeRenderJsonBody {
  head: HeadEntry[]
  content: string
  state?: unknown
}

/** Normalized development error details returned by a public render. */
export interface VueforgeRenderErrorDetails {
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

/** JSON body returned when a public render cannot complete. */
export interface VueforgeRenderErrorBody {
  error: string
  details?: VueforgeRenderErrorDetails
}

/** Body returned by a public render. */
export type VueforgeRenderBody =
  string | VueforgeRenderJsonBody | VueforgeRenderErrorBody

/** Transport-neutral result returned by a public render. */
export interface VueforgeRenderResponse {
  status: number
  headers: Record<string, string>
  body: VueforgeRenderBody
}

/** Public renderer lifecycle and render operation. */
export interface VueforgeRenderer {
  readonly mode: VueforgeRendererMode
  readonly root: string
  render(request: VueforgeRenderRequest): Promise<VueforgeRenderResponse>
  close(): Promise<void>
}

/**
 * Creates a reusable Vue SSR renderer without an HTTP framework dependency.
 *
 * The returned `render` method is transport-neutral. A custom HTTP, RPC, or
 * process adapter can map its `status`, `headers`, and `body` to its own
 * response type. Each call receives a complete request context and may select
 * a named catalog template.
 *
 * @param options - Project and runtime options.
 * @returns A renderer that must be closed when the host process shuts down.
 *
 * @example
 * ```ts
 * import { createVueforgeRenderer } from '@vitorsreis/vueforge'
 *
 * const renderer = await createVueforgeRenderer({
 *   root: process.cwd(),
 *   mode: 'production',
 * })
 *
 * const response = await renderer.render({
 *   context: { props: { title: 'Orders' } },
 *   format: 'json',
 * })
 *
 * await renderer.close()
 * ```
 */
export async function createVueforgeRenderer(
  options: VueforgeRendererOptions = {},
): Promise<VueforgeRenderer> {
  const mode = options.mode ?? 'production'
  const requestedRoot = resolve(options.root ?? process.cwd())
  const config: VueforgeConfig = await loadProjectConfig(
    requestedRoot,
    { command: 'serve', mode },
    options.configFile,
  )
  const root = resolve(config.root ?? requestedRoot)
  const limits = resolveRenderLimits(config)
  const sources =
    mode === 'development' || config.main !== undefined
      ? await resolveAppSources(root, config)
      : undefined

  const service =
    mode === 'development'
      ? await developmentRenderer(
          root,
          config,
          undefined,
          config.server?.host,
          config.server?.port,
        )
      : await productionRenderer(
          resolveBuildOutputDir(root, config.build?.outDir),
          resolveAssetBase(config.origin, config.base),
          (entry) => productionWorkerRenderer(entry, limits),
        )

  const handleRender = createRenderHandler(
    service.render,
    createRenderHandlerOptions(
      config,
      limits,
      {
        development: mode === 'development',
        interruptible: mode === 'development',
        ...(mode === 'development' ? { root } : {}),
      },
      sources,
    ),
  )

  let closed = false
  return {
    mode,
    root,
    async render(request) {
      if (closed) throw new Error('The Vueforge renderer is already closed.')
      const response = await handleRender({
        body: request.context,
        ...(request.accept === undefined ? {} : { accept: request.accept }),
        ...(request.format === undefined ? {} : { format: request.format }),
        ...(request.hydrate === undefined ? {} : { hydrate: request.hydrate }),
        ...(request.template === undefined
          ? {}
          : { template: request.template }),
        ...(request.errorFormat === undefined
          ? {}
          : { errorFormat: request.errorFormat }),
      })
      return {
        status: response.status,
        headers: { ...(response.headers ?? {}) },
        body: response.body as VueforgeRenderBody,
      }
    },
    async close() {
      if (closed) return
      closed = true
      await service.close?.()
    },
  }
}
