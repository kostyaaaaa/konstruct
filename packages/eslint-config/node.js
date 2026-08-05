import globals from 'globals';

import base from './base.js';

/**
 * Node layer on top of the base config: for services, workers and scripts that
 * run in Node rather than a browser.
 *
 * An app uses it as-is:
 *
 *   import node from '@konstruct/eslint-config/node'
 *   export default node
 *
 * ESM is the default, like the rest of the repo, so `require()` stays banned in
 * `.js`. `.cjs` is the escape hatch for a file that genuinely needs CommonJS —
 * there, `require` is allowed and expected.
 */
export default [
  ...base,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // CommonJS is built on require(); the TypeScript-oriented ban cannot apply.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
