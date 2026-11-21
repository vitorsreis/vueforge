import type { UserConfig } from 'vite'
import type { Component } from 'vue'

/** Runtime mode used by Vueforge servers and renderers. */
export type VueforgeMode = 'development' | 'production'

export {
  createVueforgeRenderer,
  type VueforgeRenderBody,
  type VueforgeRenderErrorBody,
  type VueforgeRenderErrorDetails,
  type VueforgeRenderJsonBody,
  type VueforgeRenderRequest,
  type VueforgeRenderResponse,
  type VueforgeRendererConfig,
  type VueforgeRenderer,
  type VueforgeRendererMode,
  type VueforgeRendererOptions,
} from './renderer.js'

/** A structured element accepted by document and head configuration. */
export interface HeadTag {
  tag: string
  attrs: Record<string, string>
  content?: string
}

/** A structured head element or trusted raw HTML entry. */
export type HeadEntry = HeadTag | { html: string }

/** Options used when `format: 'html'` produces a complete document. */
export interface DocumentOptions {
  /** Document doctype. Defaults to `<!doctype html>`. */
  doctype?: string
  /** Root element id. Defaults to `app`. */
  rootId?: string
  /** Attributes applied to the document `<html>` element. */
  htmlAttrs?: Record<string, string>
  /** Attributes applied to the document `<body>` element. */
  bodyAttrs?: Record<string, string>
  /** Default head entries emitted before render-generated entries. */
  head?: HeadEntry[]
}

export interface CorsOptions {
  /** Allowed request origin or origins. */
  origin?: string | RegExp | (string | RegExp)[]
  /** Methods advertised for preflight requests. */
  methods?: string | string[]
  /** Request headers advertised for preflight requests. */
  allowedHeaders?: string | string[]
  /** Response headers exposed to browser clients. */
  exposedHeaders?: string | string[]
  /** Allow credentials when an explicit origin is configured. */
  credentials?: boolean
  /** Preflight cache lifetime in seconds. */
  maxAge?: number
  /** Pass preflight requests to the next middleware. */
  preflightContinue?: boolean
  /** Status code returned for handled preflight requests. */
  optionsSuccessStatus?: number
}

export interface ServerOptions {
  /** TCP bind hostname or IP address. */
  host?: string
  /** TCP bind port. Defaults to `9901`. */
  port?: number
  /** Unix socket path. */
  unix?: string
  /** TLS certificate files for HTTPS. */
  ssl?: { key: string; cert: string; ca?: string }
  /** CORS policy. Defaults to allowing all origins without credentials. */
  cors?: boolean | string[] | CorsOptions
  /** Graceful shutdown deadline in milliseconds. */
  shutdownTimeoutMs?: number
}

interface ProjectOptions {
  /** Runtime mode used by `serve` and framework-neutral renderers. */
  mode?: VueforgeMode
  /** HTTP server, transport, TLS and CORS settings. */
  server?: ServerOptions
  /** Default response representation. */
  format?: 'html' | 'json'
  /** Absolute HTTP origin used for generated browser assets. */
  origin?: string
  /** Public path prefix used for generated browser assets. */
  base?: string
  /** Defaults used when generating a complete HTML document. */
  document?: DocumentOptions
  /**
   * Temporary staging and lock directory used by `vueforge build`.
   * Relative paths resolve from the project root. Defaults to `.vueforge`.
   */
  tempDir?: string
  /**
   * Project root used to resolve source and build paths.
   *
   * The CLI `--root` option takes precedence when selecting a project.
   */
  root?: string
  /**
   * SSR resource limits applied by persistent server transports.
   */
  limits?: {
    /** Maximum request body size in bytes. */
    maxRequestBytes?: number
    /** Maximum number of concurrent SSR renders. */
    maxConcurrentRenders?: number
    /** Maximum time allowed for one SSR render in milliseconds. */
    renderTimeoutMs?: number
    /** Maximum rendered HTML size in bytes. */
    maxOutputBytes?: number
  }
  /**
   * Build output and optimization options.
   */
  build?: {
    /** Final client and server artifact directory. */
    outDir?: string
    /** Emit source maps. */
    sourcemap?: boolean
    /** Enable output minification. */
    minify?: boolean
  }
  /**
   * Application-specific Vite options.
   *
   * Vueforge merges this object on top of the project's `vite.config.ts`, when
   * present. It supplies the project root, Vue plugin, virtual entrypoints,
   * base URL, and output layout. These options apply to development and both
   * builds.
   */
  vite?: UserConfig
}

/** Vue component, file path, or inline SFC accepted by `main`. */
export type VueforgeTemplate = string | Component

/**
 * Request data passed to a Vueforge application factory.
 *
 * `props` is forwarded to the root Vue component. `state` is the optional
 * request state returned with the render result. Additional application data
 * can be added by the backend.
 */
export type VueforgeContext<
  Props extends Record<string, unknown> = Record<string, unknown>,
  State = unknown,
> = Record<string, unknown> & {
  props?: Props
  state?: State
}

/** A request-scoped Vue application factory used by `main`. */
export type VueforgeAppFactory<
  Context extends VueforgeContext = VueforgeContext,
  App = object,
> = (context: Context) => App | Promise<App>

/** Named Vue component sources used by a main template catalog. */
export type VueforgeTemplateCatalog = Record<string, VueforgeTemplate>

/**
 * Template catalog input accepted by `main`.
 *
 * A string selects a directory or a regular expression selects Vue files
 * below `src`. A record maps request template names to Vue sources.
 */
export type VueforgeTemplates = string | RegExp | VueforgeTemplateCatalog

/** The single application source selected by `vueforge.config.ts`. */
export type VueforgeMain<Context extends VueforgeContext = VueforgeContext> =
  VueforgeTemplates | VueforgeTemplate | VueforgeAppFactory<Context>

/**
 * Project settings read from the default export of `vueforge.config.ts`.
 *
 * `main` selects the Vue application source. A string can be a Vue SFC, an
 * application entry module, or a directory of Vue templates. A regular
 * expression selects Vue files below `src`. An object selects a named catalog.
 *
 * When `main` is omitted, Vueforge uses `src/App.vue`.
 */
export type VueforgeConfig = ProjectOptions & { main?: VueforgeMain }

/**
 * Provides type checking and editor completion for a Vueforge configuration.
 * The CLI applies defaults and command-line overrides when it loads the project.
 * The helper returns the same object without changing it at runtime.
 *
 * @param config - Options for the current project.
 * @returns The supplied configuration object.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@vitorsreis/vueforge'
 *
 * export default defineConfig({
 *   main: 'src/App.vue',
 *   server: { port: 4300 },
 *   tempDir: '.cache/vueforge',
 *   build: { outDir: 'dist/vueforge' },
 * })
 * ```
 */
/** Keeps contextual typing for inline request-scoped handlers. */
export function defineConfig(
  config: ProjectOptions & { main: VueforgeAppFactory },
): VueforgeConfig
// The overloads intentionally preserve contextual typing for direct handlers.
// eslint-disable-next-line @typescript-eslint/unified-signatures
export function defineConfig(config: VueforgeConfig): VueforgeConfig
export function defineConfig(config: VueforgeConfig): VueforgeConfig {
  return config
}

/**
 * Types a request-scoped Vue app factory without changing its runtime value.
 *
 * @param factory - A function that creates a fresh Vue app for one request.
 * @returns The same factory for use as an entry module export.
 *
 * @example
 * ```ts
 * import { createSSRApp } from 'vue'
 * import { createVueforgeApp } from '@vitorsreis/vueforge'
 *
 * export default createVueforgeApp((context) =>
 *   createSSRApp(App, { ...context.props, user: context.user }),
 * )
 * ```
 */
export function createVueforgeApp<
  Context extends VueforgeContext = VueforgeContext,
  App = object,
>(factory: VueforgeAppFactory<Context, App>): VueforgeAppFactory<Context, App> {
  return factory
}
