# konstruct

A platform built as a pnpm monorepo. A dashboard is the entry point, and from
there you navigate into distinct apps. Shared code lives in `packages/` and is
installed into any app that needs it.

## Requirements

- Node >= 22
- pnpm 11 (`corepack enable` picks up the version pinned in `package.json`)

## Getting started

```bash
pnpm install            # installs the workspace and the git hooks
pnpm dev dashboard      # run an app in dev, by name or alias
pnpm format             # Prettier over the repo
pnpm lint               # ESLint over the repo
```

`pnpm dev` takes one or more apps, separated by commas or spaces, and runs them
in parallel — `pnpm dev dashboard, dota`. Each app pins its own port. Run it
with no arguments to list what is available.

## Layout

```
apps/        every app, one workspace package each — empty for now
packages/    shared code, installed as "@konstruct/<name>": "workspace:*"
docs/        project documentation and the rules Claude Code follows
```

Full breakdown: [docs/project/structure.md](docs/project/structure.md).

## Apps

| App                   | What it is                                    | Docs                                     |
| --------------------- | --------------------------------------------- | ---------------------------------------- |
| `konstruct-dashboard` | The platform shell — lists and links to apps. | [docs](docs/apps/konstruct-dashboard.md) |

```bash
pnpm dev dashboard     # http://localhost:3000
```

Apps are separate deployments with their own frontend and backend; the dashboard
links to them by URL. See [app routing](docs/project/overview.md#app-routing).

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
