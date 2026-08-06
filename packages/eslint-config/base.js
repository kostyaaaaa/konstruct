import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Base ESLint flat config: JavaScript + TypeScript, framework-agnostic.
 *
 * Apps extend it and override locally:
 *
 *   import base from '@konstruct/eslint-config/base'
 *   export default [
 *     ...base,
 *     { rules: { 'no-console': 'off' } },
 *   ]
 *
 * Later entries win, so anything appended overrides the base.
 * Framework layers (React, Next, Node) belong in sibling exports of this
 * package, not inline in an app.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**', '**/.next/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2024 },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  // Disables every rule Prettier already handles.
  prettier,
  {
    /**
     * Re-enabled **after** `prettier`, which switches `curly` off by default.
     *
     * `eslint-config-prettier` disables it because some of its options can
     * fight the formatter. `"all"` cannot: braces change the syntax tree, not
     * the formatting, so Prettier has no opinion on them.
     *
     * This block has to stay last. Put the rule above `prettier` and it is
     * silently set to severity 0 — the config still loads, lint still passes,
     * and nothing is enforced.
     */
    rules: {
      /**
       * Braces on every block, even a one-line `if`.
       *
       * A braceless body is one careless edit away from a bug: adding a second
       * statement leaves it outside the branch while the indentation claims
       * otherwise.
       */
      curly: ['error', 'all'],
    },
  },
);
