import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['build']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactRefresh.configs.vite],
    plugins: { 'react-hooks': reactHooks },
    // The two classic hooks rules CRA enforced. react-hooks v7's `recommended`
    // adds React Compiler rules; adopting those is on the roadmap.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: { globals: globals.vitest },
  },
  {
    files: ['scripts/**', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
]);
