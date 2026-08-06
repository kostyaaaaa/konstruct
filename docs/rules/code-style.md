# Code style and tooling rules

## 1. pnpm is the only package manager

Manage every app and package through pnpm. Never use npm or yarn, and never edit
`node_modules` or `pnpm-lock.yaml` by hand.

```bash
pnpm dev <app>[, <app>...]                    # run apps in dev, by name or alias
pnpm install                                  # whole workspace
pnpm --filter <app> add <dep>                 # dependency for one workspace package
pnpm --filter <app> add @konstruct/<pkg> --workspace   # shared package
pnpm --filter <app> <script>                  # run a script in one package
pnpm -r <script>                              # run a script everywhere
```

Shared packages are always referenced as `"@konstruct/<name>": "workspace:*"`.

## 2. Prettier and ESLint decide formatting and lint

All written code must already satisfy the shared configs — do not hand-format
against personal preference, and do not leave lint errors for later.

- Formatting: `@konstruct/prettier-config` (single quotes, semicolons, 100 cols,
  trailing commas). VSCode formats on save; `pnpm format` does the same in bulk.
- Linting: `@konstruct/eslint-config/base` (JS + TypeScript, framework-agnostic).
- After a non-trivial change, run `pnpm format` and `pnpm lint` and fix what they
  report.
- Never silence a rule with an inline disable to make a change pass. Fix the
  code, or change the shared config deliberately and say why.

## 3. Every commit is formatted and linted

A husky `pre-commit` hook runs lint-staged over staged files only:

| Staged files                            | What runs                               |
| --------------------------------------- | --------------------------------------- |
| `.js .mjs .cjs .jsx .ts .mts .cts .tsx` | `eslint --fix`, then `prettier --write` |
| `.json .md .yml .yaml .css .scss .html` | `prettier --write`                      |

Fixes are re-staged automatically. A remaining ESLint **error** aborts the
commit — fix the code rather than passing `--no-verify`.

ESLint resolves its config from each staged file's own directory
(`--flag v10_config_lookup_from_file`), so an app's local `eslint.config.js`
applies to that app's files even though the hook runs from the repo root.

The hook is installed by the `prepare` script, which pnpm runs on install.

## 4. Configs layer, they do not fork

The packages hold the global behavior; an app overrides locally only what it
genuinely needs.

TypeScript layers the same way, through `@konstruct/tsconfig`:

| Config      | For                                                     |
| ----------- | ------------------------------------------------------- |
| `base.json` | Every app. Strictness and the rules that never differ.  |
| `nest.json` | NestJS services. Decorator metadata, nodenext modules.  |
| `next.json` | Next.js apps. DOM lib, JSX, bundler resolution, noEmit. |

An app extends one of these and overrides only what its own layout forces —
`outDir`, `rootDir`, `paths`:

```json
{
  "extends": "@konstruct/tsconfig/nest.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*.ts"]
}
```

A single config for every app is not possible: a Nest service must emit
JavaScript and decorator metadata, while a Next app emits nothing and needs
DOM types. Those are genuine conflicts, not preferences. Everything that is
not a genuine conflict lives in `base.json`.

```js
// apps/<app>/eslint.config.js — later entries win
import base from '@konstruct/eslint-config/base'
export default [...base, { rules: { 'no-console': 'off' } }]

// apps/<app>/prettier.config.js
import base from '@konstruct/prettier-config'
export default { ...base, printWidth: 120 }
```

An override that turns out to be right for everything belongs in the shared
package instead. Framework rule sets become new exports of
`@konstruct/eslint-config`, not copies inside an app. Three exist today:

| Export   | For                                                        |
| -------- | ---------------------------------------------------------- |
| `./base` | Any package. JavaScript + TypeScript, framework-agnostic.  |
| `./nest` | NestJS apps. Layers on `./node`, plus the decorator fixes. |
| `./next` | Next.js apps. Next rules, rules of hooks, browser globals. |
| `./node` | Node services and workers. ESM `.js`, Node globals.        |

Add `./react` and the rest the same way.

**`./nest` exists for a reason worth knowing.** `consistent-type-imports` wants
`import type` for anything used only as a type — and every injected service
looks that way, because it appears only as a constructor parameter type. But
NestJS resolves injection from `emitDecoratorMetadata`, which needs the class's
**value** at runtime. `import type` erases it, the metadata degrades to
`Function`, and the container fails at startup with
`UnknownDependenciesException`. The code still compiles, so the rule's autofix
silently breaks dependency injection across a whole app. `./nest` turns that
rule off.

Every app in this repo is ESM (`"type": "module"`), so `eslint.config.js` works
everywhere. If an app ever has to be CommonJS, its config file must be named
`eslint.config.mjs`, because a CommonJS package cannot load a `.js` config
written with `import`.
