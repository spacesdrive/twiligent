import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['**/dist', '**/.wrangler', '**/node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // shadcn files export their cva variants and contexts export their hooks; editing those files reloads the page
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true,
        allowExportNames: ['badgeVariants', 'buttonVariants', 'tabsListVariants', 'toggleVariants', 'useSidebar', 'useAppContext', 'useAuth'],
      }],
    },
  },
  {
    // the worker runs on the web platform, so it gets service worker globals, not node
    files: ['backend/**/*.ts'],
    languageOptions: {
      globals: globals.serviceworker,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['backend/tests/**/*.ts', 'frontend/tests/**/*.ts', 'frontend/vite.config.ts', 'scripts/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['*.js', '*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
])
