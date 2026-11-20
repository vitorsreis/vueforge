import type { UserConfig } from 'vite'

/** Project settings read from the default export of `vueforge.config.ts`. */
export interface VueForgeConfig {
  /** Listener hostname or IP address. Defaults to `127.0.0.1`; overridden by `serve --host`. */
  host?: string
  /** TCP port from 1 to 65535. Defaults to 9901; overridden by `serve --port`. */
  port?: number
  /** Directory containing the client and server builds. Relative paths resolve from the project root. Defaults to `.vueforge`. */
  tempDir?: string
  /** Vite options for development and both builds. VueForge supplies the Vue plugin, entrypoints and output layout. */
  vite?: UserConfig
}

/**
 * Provides type checking and editor completion for a VueForge configuration.
 * The CLI applies defaults and command-line overrides when it loads the project.
 *
 * @param config - Options for the current project.
 * @returns The supplied configuration object.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'vueforge'
 *
 * export default defineConfig({ port: 4300, tempDir: '.cache/vueforge' })
 * ```
 */
export function defineConfig(config: VueForgeConfig): VueForgeConfig {
  return config
}
