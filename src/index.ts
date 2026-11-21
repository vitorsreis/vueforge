import type { UserConfig } from 'vite'

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
  /**
   * Directory where `vueforge build` writes the client and server artifacts.
   * Relative paths resolve from the project root. Defaults to `.vueforge`.
   */
  tempDir?: string
  /**
   * Application-specific Vite options.
   *
   * VueForge supplies the project root, Vue plugin, virtual entrypoints, base
   * URL, and output layout. These options apply to development and both builds.
   */
  vite?: UserConfig
}

type AppSource =
  | { file?: string; template?: never; entry?: never }
  | { file?: never; template: string; entry?: never }
  | { file?: never; template?: never; entry: string }

/**
 * Project settings read from the default export of `vueforge.config.ts`.
 *
 * Choose exactly one source when overriding the default:
 *
 * - `file` selects a project-relative `.vue` file.
 * - `template` supplies an inline Vue SFC.
 * - `entry` selects a project-relative app factory module.
 *
 * When all three source properties are omitted, VueForge uses `src/App.vue`.
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
 * export default defineConfig({ port: 4300, tempDir: '.cache/vueforge' })
 * ```
 */
export function defineConfig(config: VueForgeConfig): VueForgeConfig {
  return config
}
