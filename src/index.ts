import type { UserConfig } from 'vite'
import type { Component } from 'vue'

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

/** Vue component or inline SFC accepted by `template`. */
export type VueforgeTemplate = string | Component

/** A request-scoped Vue application factory used by `entry`. */
export type VueforgeAppFactory<
  Context = Record<string, unknown>,
  Props = Record<string, unknown>,
  App = object,
> = (context: Context, props: Props) => App | Promise<App>

/**
 * Project settings read from the default export of `vueforge.config.ts`.
 *
 * `template` selects one Vue component. `entry` selects a module that creates
 * the Vue app for each request. `templates` selects a named catalog of Vue
 * components and requires the request body to include `template`.
 *
 * When all three options are omitted, Vueforge uses `src/App.vue`.
 */
export type VueforgeConfig = ProjectOptions & {
  template?: VueforgeTemplate
  entry?: string
  templates?: string | Record<string, VueforgeTemplate>
}

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
 *   template: 'src/App.vue',
 *   server: { port: 4300 },
 *   tempDir: '.cache/vueforge',
 *   build: { outDir: 'dist/vueforge' },
 * })
 * ```
 */
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
 * export default createVueforgeApp((context, props) =>
 *   createSSRApp(App, { ...props, user: context.user }),
 * )
 * ```
 */
export function createVueforgeApp<
  Context = Record<string, unknown>,
  Props = Record<string, unknown>,
  App = object,
>(
  factory: VueforgeAppFactory<Context, Props, App>,
): VueforgeAppFactory<Context, Props, App> {
  return factory
}
