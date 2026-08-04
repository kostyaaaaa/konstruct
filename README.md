# konstruct

A platform built as a pnpm monorepo. A dashboard is the entry point, and from
there you navigate into distinct apps. Shared code lives in `packages/` and is
installed into any app that needs it.

## Requirements

- Node >= 22
- pnpm 11 (`corepack enable` picks up the version pinned in `package.json`)

## Getting started

```bash
pnpm install     # installs the workspace and the git hooks
pnpm format      # Prettier over the repo
pnpm lint        # ESLint over the repo
```

## Layout

```
apps/        every app, one workspace package each — empty for now
packages/    shared code, installed as "@konstruct/<name>": "workspace:*"
docs/        project documentation and the rules Claude Code follows
```

Full breakdown: [docs/project/structure.md](docs/project/structure.md).

## Apps

None yet. Each app will get a section here and a document in
[docs/apps/](docs/apps/README.md) describing what it does and how to run it.

## Conventions

- **pnpm only** — never npm or yarn.
- **Prettier and ESLint** — shared via `@konstruct/prettier-config` and
  `@konstruct/eslint-config/base`; apps extend rather than fork them.
- **Pre-commit** — husky runs lint-staged, so staged files are formatted and
  linted before every commit.
- **Commits** — Conventional Commits.

Details in [docs/rules/code-style.md](docs/rules/code-style.md).

## Documentation

[docs/index.md](docs/index.md) is the entry point and lists every document.
`CLAUDE.md` imports it, so the rules and project docs are in context for every
Claude Code session.
