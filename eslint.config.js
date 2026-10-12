import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['build']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    rules: {
      // useDisposable takes deps like useMemo; check them at each call site.
      'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '^useDisposable$' }],
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**'],
    languageOptions: { globals: globals.vitest },
  },
  {
    files: ['scripts/**', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
