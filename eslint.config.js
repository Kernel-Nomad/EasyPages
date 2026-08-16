import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'node_modules', 'uploads', 'easypages-data'] },
  js.configs.recommended,

  // Node side: server, core domain, config, scripts and tests. No JSX, no browser globals.
  {
    files: [
      'src/index.js',
      'server.js',
      'src/api/server/**/*.js',
      'src/core/**/*.js',
      'src/config/**/*.js',
      'src/utils/**/*.js',
      'src/shared/**/*.js',
      'tests/**/*.js',
      'scripts/**/*.mjs',
      '*.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // Express error handlers must declare four parameters for Express to recognise them, so
  // the trailing `next` is unused by construction. `_`-prefixing is the opt-out.
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.js', 'scripts/**/*.mjs'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },

  // Browser side: the React bundle and the API client it imports.
  {
    files: [
      'src/web/**/*.{js,jsx}',
      'src/api/client/**/*.js',
      'src/shared/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // Mind the preset: `configs["recommended-latest"]` is still eslintrc format and eslint 10
  // rejects it. The flat one lives under `configs.flat` and is an object, not an array.
  {
    ...reactHooks.configs.flat['recommended-latest'],
    files: ['src/web/**/*.{js,jsx}'],
  },
  // Same trap: the flat preset is `flatConfigs.recommended`. It is what stops unlabelled
  // inputs and roleless dialogs coming back into the auth views.
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['src/web/**/*.{js,jsx}'],
  },
  {
    files: ['src/web/**/*.{js,jsx}'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The v7 preset also brings the React Compiler rules. This is plain React 18 and
      // these two reject idiomatic code here (the fetch-on-mount effects in App.jsx and
      // useDashboardState). rules-of-hooks and exhaustive-deps stay on.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },

  // Vitest files import their own globals (`globals: false` in vitest.config.js), so no
  // ambient names are needed — only the jsdom ones the browser block already provides.
  {
    files: ['src/web/**/*.test.{js,jsx}', 'src/web/test/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
];
