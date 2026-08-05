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
- **Dashboard stack** — Next.js 16 App Router, React 19, TypeScript, Tailwind
  CSS 4. Applies to the dashboard; a later app may pick differently.

## App routing

Apps are separate deployments. The dashboard links to them by URL and assumes
nothing about where they live — every card's target is an opaque `href`.

Not every app has a URL. `dota-bet-analytics` is a worker with no HTTP server,
so its card points at `#` and the routing question below does not apply to it.

That leaves three options open, in increasing order of coupling:

1. **Separate domains** — the card links out. Current approach.
2. **One domain, path-based** — Next.js `rewrites` proxy `/<app>` to the app's
   deployment.
3. **Multi-zones / Vercel Microfrontends** — separate projects, one domain,
   shared routing config.

Moving between them is a change to the `href` values plus routing config, not a
change to the dashboard.

## Still open

- Frontend framework for apps other than the dashboard. On the backend the
  choice is settled: Express or NestJS, per app.
- Whether apps stay in `apps/` or move to separate repositories — this decides
  whether shared packages stay `workspace:*` or get published to a registry.
- Which routing option above to commit to, once a real app is deployed.
- Build orchestration (Turborepo or plain pnpm scripts), now that one package
  builds and more will.
- Where a long-running worker is hosted. Vercel runs functions per request and
  cannot hold a cron process alive, so `dota-bet-analytics` needs a different
  host than the dashboard.

## Status

Two apps, neither deployed.

- `konstruct-dashboard` — the shell. Lists a static set of apps and filters them
  by name. Every `href` is still `#`.
- `dota-bet-analytics` — a Node cron worker, moved in from its own repository.
  It runs locally and has no HTTP server, so the dashboard cannot link to it
  yet.
