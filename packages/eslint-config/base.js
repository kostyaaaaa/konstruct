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
  // Must stay last: disables every rule Prettier already handles.
  prettier,
);
