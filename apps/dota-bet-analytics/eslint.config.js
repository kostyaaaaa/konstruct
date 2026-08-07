import nest from '@konstruct/eslint-config/nest';

export default [
  ...nest,
  { ignores: ['dist/**'] },
  {
    /**
     * `research/` is a set of command-line scripts whose entire output is what
     * they print. `no-console` is the right rule for a server and the wrong
     * one here — a script that cannot print has no way to report anything.
     *
     * Scoped to the folder rather than disabled inline, so the rule keeps
     * applying everywhere it should.
     */
    files: ['research/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
];
