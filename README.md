# konstruct

A platform built as a pnpm monorepo. A dashboard is the entry point, and from
there you navigate into distinct apps. Shared code lives in `packages/` and is
installed into any app that needs it.

## Requirements

- Node >= 22
- pnpm 11 (`corepack enable` picks up the version pinned in `package.json`)
- [Infisical CLI](https://infisical.com/docs/cli/overview), for apps that need
  secrets

## Getting started

```bash
pnpm install            # every app and package, plus the git hooks
pnpm dev dashboard      # run an app in dev, by name or alias
pnpm format             # Prettier over the repo
pnpm lint               # ESLint over the repo
```

**`pnpm install` at the root installs everything** — every app and every package
in one pass, into one shared `node_modules` store with links into each package.
That is what the workspace is for, so there is no per-app install step and no
separate "install all" command. Run it from the root after pulling, after adding
an app, or whenever a dependency changes.

To add a dependency, name the package it belongs to rather than installing from
inside its folder:

```bash
pnpm --filter <app> add <dep>
pnpm --filter <app> add @konstruct/<pkg> --workspace
```

`pnpm dev` takes one or more apps, separated by commas or spaces, and runs them
in parallel — `pnpm dev dashboard, dota`. **With no arguments it runs
everything.**

A product split into a frontend and a backend has a group name covering both:

```bash
pnpm dev dota            # API and console together
pnpm dev dota-server     # the API alone
pnpm dev dota-console    # the console alone
```

## Secrets

Secrets live in [Infisical](https://infisical.com) and are injected as
environment variables when a script runs. They are never committed, and there is
no `.env.example` to copy.

**The whole monorepo uses one Infisical project, `Konstruct`.** Inside it,
secrets are separated two ways:

- **Environment** — `dev`, `staging`, `prod`. Chosen with `--env`, defaulting to
  `dev`.
- **Folder** — one per app, named after the app: `/konstruct-dashboard`,
  `/dota-bet-analytics`. Chosen with `--path`.

So `dev` + `/dota-bet-analytics` is one set of values, and `prod` +
`/dota-bet-analytics` is another. An app only ever sees its own folder.

Setup, once per machine:

```bash
brew install infisical/get-cli/infisical    # or see infisical.com/docs/cli
infisical login
infisical init                               # from the repo root, pick "Konstruct"
```

`infisical init` writes `.infisical.json` **at the repo root**, holding the
project id and the default environment. It contains no secret values and is
committed. One file for the whole workspace — apps do not each get their own,
because they all belong to the same project.

Each app then names its own folder in its scripts:

```json
{ "dev": "infisical run --path=/dota-bet-analytics -- nodemon ./src/index.js" }
```

To run against another environment, add `--env`:

```bash
pnpm --filter dota-bet-analytics exec infisical run --env=prod --path=/dota-bet-analytics -- node ./src/index.js
```

Which variables an app needs is listed in that app's document. Adding a variable
means adding it in Infisical, in the app's folder, for every environment that
needs it — and adding it to that list.

Four variables are the same in every app: `ENV`, `AXIOM_DATASET`, `AXIOM_TOKEN`
and `AXIOM_EDGE`. `AXIOM_DATASET` is always the app's own name. An app that
serves HTTP also gets `PORT` — the port is a variable, not a flag in
`package.json`. See the [checklist](docs/apps/README.md#adding-a-new-app).

## Layout

```
apps/        every app, one workspace package each
packages/    shared code, installed as "@konstruct/<name>": "workspace:*"
docs/        project documentation and the rules Claude Code follows
scripts/     repo-level tooling, run through the root package.json
```

Full breakdown: [docs/project/structure.md](docs/project/structure.md).

## Apps

| App                          | What it is                                      | Docs                                            |
| ---------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `konstruct-dashboard`        | The platform shell — lists and links to apps.   | [docs](docs/apps/konstruct-dashboard.md)        |
| `dota-bet-analytics`         | API + workers tracking live Dota 2 pro matches. | [docs](docs/apps/dota-bet-analytics.md)         |
| `dota-bet-analytics-console` | Its console — control, matches, predictions.    | [docs](docs/apps/dota-bet-analytics-console.md) |

```bash
pnpm dev               # everything
pnpm dev dashboard     # http://localhost:3000
pnpm dev dota          # API on :4001 and console on :4000
```

Apps are separate deployments; the dashboard links to them by URL. See
[app routing](docs/project/overview.md#app-routing). Adding one is a checklist —
follow [docs/apps/README.md](docs/apps/README.md#adding-a-new-app).

## Conventions

- **pnpm only** — never npm or yarn.
- **Prettier and ESLint** — shared via `@konstruct/prettier-config` and
  `@konstruct/eslint-config` (`./base`, `./nest`, `./next`, `./node`); apps
  extend rather than fork them.
- **Secrets in Infisical** — never in a committed file.
- **Logs to Axiom** — through `@konstruct/logger`, one dataset per app, never a
  `logs/` folder.
- **Pre-commit** — husky runs lint-staged, so staged files are formatted and
  linted before every commit.
- **Commits** — Conventional Commits.

Details in [docs/rules/code-style.md](docs/rules/code-style.md).

## Documentation

[docs/index.md](docs/index.md) is the entry point and lists every document.
`CLAUDE.md` imports it, so the rules and project docs are in context for every
Claude Code session.
