# konstruct — overview

konstruct is a platform. A dashboard page is the entry point, and from there the
user navigates into distinct apps.

## Structure

- pnpm monorepo. Shared code lives in `packages/`, apps in `apps/`.
- The dashboard is the shell that lists those apps and links into them.
- Layout and conventions: [structure.md](structure.md).

## Decisions made

- **Package manager** — pnpm, workspaces. Node >= 22.
- **Formatting** — Prettier, shared via `@konstruct/prettier-config`, format on
  save in VSCode.
- **Linting** — ESLint 9 flat config, shared via `@konstruct/eslint-config`
  (`./base` for any package, `./next` for Next.js apps, `./node` for Node
  services).
- **Git hooks** — husky + lint-staged, formatting and lint enforced on
  `pre-commit`.
- **Module format** — ESM everywhere. Every app and package is
  `"type": "module"`. `.cjs` is the escape hatch if something ever needs
  CommonJS.
- **Secrets** — Infisical, injected by `infisical run` when a script starts.
  One project, `Konstruct`, for the whole monorepo; one folder inside it per app,
  crossed with the `dev` / `staging` / `prod` environments. No committed `.env`,
  and no `.env.example` — an app's variables are listed in its document instead.
- **Logs** — Axiom, one dataset per app, with the console alongside it. No app
  writes log files. Apps never talk to Axiom directly: `@konstruct/logger`
  wraps it, with a `./server` entry point that holds the token and a `./client`
  one that cannot.
- **Backend framework** — Express or NestJS, chosen per app and recorded in that
  app's document. [Rules](../rules/backend.md), [NestJS rules](../rules/nestjs.md).
- **Hosting** — Vercel for Next.js apps, Railway for anything that must stay
  alive.
- **Database** — MongoDB Atlas, one cluster, dev and prod split by database
  name.
- **Notifications** — a Telegram bot, not email. No project domain exists, and
  every mail provider requires a verified sending domain.
- **Frontend stack** — Next.js 16 App Router, React 19, TypeScript, Tailwind
  CSS 4. Both frontends use it.

Every service and core dependency is catalogued in
[infrastructure.md](infrastructure.md), including what is deliberately not
used.

## App routing

Apps are separate deployments. The dashboard links to them by URL and assumes
nothing about where they live — every card's target is an opaque `href`.

A card can point at something other than the app itself. `dota-bet-analytics`
is an API with workers and no UI, so its card links to
`dota-bet-analytics-console` instead.

Every `href` resolves per environment, so the dashboard links to localhost in
dev and to the deployed URL in prod. That depends on `ENV` being set in the
dashboard's own environment.

That leaves three options open, in increasing order of coupling:

1. **Separate domains** — the card links out. Current approach.
2. **One domain, path-based** — Next.js `rewrites` proxy `/<app>` to the app's
   deployment.
3. **Multi-zones / Vercel Microfrontends** — separate projects, one domain,
   shared routing config.

Moving between them is a change to the `href` values plus routing config, not a
change to the dashboard.

## Still open

- Whether apps stay in `apps/` or move to separate repositories — this decides
  whether shared packages stay `workspace:*` or get published to a registry.
- Which routing option above to commit to. Separate domains work; nothing yet
  forces a change.
- Build orchestration (Turborepo or plain pnpm scripts), now that three apps
  build.
- Testing. There is no test runner and no tests, in any app.

## Status

Three apps, all deployed.

- `konstruct-dashboard` — the shell, on Vercel. Lists a static set of apps and
  filters them by name.
- `dota-bet-analytics` — NestJS API and in-process workers, on Railway. Polls
  live professional matches, archives snapshots, scores predictions and posts
  a report to Telegram.
- `dota-bet-analytics-console` — its frontend, on Vercel. Worker control, live
  matches, predictions and accuracy, and recent logs.
