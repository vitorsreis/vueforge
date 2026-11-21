import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores([
    'dist/**',
    'coverage/**',
    '**/.vueforge/',
    'examples/**/dist/**',
  ]),
  js.configs.recommended,
  { files: ['bin/vueforge'], extends: [js.configs.recommended] },
  {
    files: ['src/**/*.ts'],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
