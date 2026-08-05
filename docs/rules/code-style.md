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
`@konstruct/eslint-config`, not copies inside an app. `./next` already exists
(Next.js rules, hooks rules, browser globals); add `./react`, `./node` and the
rest the same way.
