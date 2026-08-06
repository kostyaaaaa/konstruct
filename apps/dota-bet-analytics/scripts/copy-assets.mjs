import { cp } from 'node:fs/promises';

/**
 * Copies non-TypeScript assets into `dist`.
 *
 * `tsc` only emits what it compiles, so the Handlebars template would be
 * missing at runtime and the report would fail on the first match rather than
 * at build time.
 */
await cp('src/templates', 'dist/templates', { recursive: true });
console.log('copied src/templates -> dist/templates');
