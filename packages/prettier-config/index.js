/**
 * Shared Prettier configuration.
 *
 * Apps extend this by spreading it in their own `prettier.config.js`:
 *
 *   import base from '@konstruct/prettier-config'
 *   export default { ...base, printWidth: 120 }
 *
 * @type {import('prettier').Config}
 */
export default {
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  // Markdown is wrapped by hand in this repo; leave existing line breaks alone.
  proseWrap: 'preserve',
};
