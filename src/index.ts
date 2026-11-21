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

interface ProjectOptions {
  /**
   * Hostname or IP address used by the HTTP server.
   *
   * Defaults to `127.0.0.1`. The `serve --host` option overrides this value
   * for one invocation.
   */
  host?: string
  /**
   * TCP port used by the HTTP server.
   *
   * Defaults to `9901`. The `serve --port` option overrides this value for one
   * invocation.
   */
  port?: number
  /** Unix domain socket path. Mutually exclusive with the TCP listener. */
  unix?: string
  /** TLS certificate files for the HTTP adapter. */
  ssl?: { key: string; cert: string; ca?: string }
  /** Graceful shutdown deadline in milliseconds. */
  shutdownTimeoutMs?: number
  /** Default response representation. */
  format?: 'html' | 'json'
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
   * VueForge merges this object on top of the project's `vite.config.ts`, when
   * present. It supplies the project root, Vue plugin, virtual entrypoints,
   * base URL, and output layout. These options apply to development and both
   * builds.
   */
  vite?: UserConfig
}

type AppSource =
  | { template: string | Component; entry?: never }
  | { template?: never; entry: string }
  | { template?: never; entry?: never }

/**
 * Project settings read from the default export of `vueforge.config.ts`.
 *
 * Choose exactly one source when overriding the default:
 *
 * - `entry` selects a project-relative `.vue` component or app factory module.
 * - `template` supplies an inline Vue SFC or an imported Vue component.
 *
 * When all source properties are omitted, VueForge uses `src/App.vue`.
 */
export type VueForgeConfig = ProjectOptions & AppSource

/**
 * Provides type checking and editor completion for a VueForge configuration.
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
 *   port: 4300,
 *   tempDir: '.cache/vueforge',
 *   build: { outDir: 'dist/vueforge' },
 * })
 * ```
 */
export function defineConfig(config: VueForgeConfig): VueForgeConfig {
  return config
}
