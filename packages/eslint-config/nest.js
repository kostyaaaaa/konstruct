import node from './node.js';

/**
 * NestJS layer on top of the Node config.
 *
 * An app uses it as-is:
 *
 *   import nest from '@konstruct/eslint-config/nest'
 *   export default nest
 */
export default [
  ...node,
  {
    files: ['**/*.ts'],
    rules: {
      /**
       * Off, and this one is not a preference.
       *
       * NestJS resolves constructor injection from `design:paramtypes`, which
       * `emitDecoratorMetadata` writes as a reference to the *value* of each
       * parameter's class. `import type` erases that binding, so the metadata
       * degrades to `Function` and the container cannot resolve the provider.
       *
       * The trap is that it still compiles. The failure only appears at
       * startup, as:
       *
       *   UnknownDependenciesException: Nest can't resolve dependencies of
       *   the HeroesService (HeroModel, ?, Function)
       *
       * Since every injected service looks type-only to the rule, its autofix
       * silently breaks dependency injection across a whole app.
       */
      '@typescript-eslint/consistent-type-imports': 'off',

      /**
       * Nest declares dependencies as parameter properties
       * (`constructor(private readonly x: X) {}`), so an injected dependency
       * that is only used in one method still looks unused to this rule.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreClassWithStaticInitBlock: true,
        },
      ],
    },
  },
];
