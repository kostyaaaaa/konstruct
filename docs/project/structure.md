# Repository structure

pnpm workspace. Workspace roots are declared in `pnpm-workspace.yaml`.

```
konstruct/
├── apps/                      # every app, one workspace package each
│   ├── konstruct-dashboard/   # the platform shell (Next.js)
│   └── dota-bet-analytics/    # Dota match report worker (Node, cron)
├── packages/                  # shared code, installable into any app
│   ├── eslint-config/         # @konstruct/eslint-config → ./base, ./next, ./node
│   ├── logger/                # @konstruct/logger → ./server, ./client
│   └── prettier-config/       # @konstruct/prettier-config
├── docs/
│   ├── index.md               # imports of the always-loaded docs
│   ├── rules/                 # rules for Claude — always in context
│   ├── project/               # overview, structure — always in context
│   └── apps/                  # one file per app — read on demand
├── pnpm-workspace.yaml        # workspace roots + reviewed install-script exceptions
├── .infisical.json            # links the workspace to the Konstruct project (no secrets)
├── scripts/                   # repo-level tooling run through root scripts
│   ├── apps.config.js         # app names + dev aliases
│   └── dev.js                 # `pnpm dev <app>[, <app>...]`
├── .claude/
│   └── settings.json          # Claude Code model + auto-allowed commands
├── .husky/
│   └── pre-commit             # runs lint-staged
├── README.md                  # human entry point — setup, commands, conventions
├── eslint.config.js           # repo-level lint, extends the shared base
├── prettier.config.js         # re-exports the shared config
└── package.json               # private root, scripts + lint-staged config
```

## packages/

Anything used by more than one app: UI, auth, config, types, tooling. Named
`@konstruct/<name>` and consumed as `"@konstruct/<name>": "workspace:*"`.

Config packages are currently `private: true`. They resolve across the workspace
that way, but not from a repository outside it — publishing to a registry is the
open question below.

## apps/

One workspace package per app. Each owns its `package.json` and
`eslint.config.js`; see [apps/README.md](../../apps/README.md).

- `konstruct-dashboard` — the shell listing every app.
  [Docs](../apps/konstruct-dashboard.md).
- `dota-bet-analytics` — Node worker, no HTTP server.
  [Docs](../apps/dota-bet-analytics.md).

## scripts/

Tooling that belongs to the repo rather than to one app, run through a root
script. `dev.js` resolves app names and aliases from `apps.config.js` and hands
them to pnpm; registering a new app there is what makes `pnpm dev <app>` work.

## docs/apps/

Every app gets `docs/apps/<app-name>.md` describing what it is, what it owns, and
how it is run. These are deliberately **not** imported by `docs/index.md` — only
the rules and project docs stay permanently in context. App docs are read when
working on that app.

## Open question

The original intent was one repository per app. Apps currently live in `apps/`
inside this monorepo instead. If they do move out to separate repositories,
shared packages have to be published to a registry rather than linked with
`workspace:*`. Decide before the second app exists.
