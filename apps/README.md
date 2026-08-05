# apps

Every konstruct app lives here as its own pnpm workspace package.

- `konstruct-dashboard` — the platform shell.
  [Docs](../docs/apps/konstruct-dashboard.md).
- `dota-bet-analytics` — worker that emails a report on live Dota 2 pro matches.
  [Docs](../docs/apps/dota-bet-analytics.md).

Adding one is a checklist, not just a folder — `pnpm dev`, the dashboard's app
list and the docs all have to be told it exists. Follow
[docs/apps/README.md](../docs/apps/README.md#adding-a-new-app).

Layout and conventions: [docs/project/structure.md](../docs/project/structure.md).
