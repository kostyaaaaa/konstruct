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
  (`./base` for any package, `./next` for Next.js apps).
- **Git hooks** — husky + lint-staged, formatting and lint enforced on
  `pre-commit`.
- **Dashboard stack** — Next.js 16 App Router, React 19, TypeScript, Tailwind
  CSS 4. Applies to the dashboard; a later app may pick differently.

## App routing

Apps are separate deployments with their own frontend and backend. The dashboard
links to them by URL and assumes nothing about where they live — every card's
target is an opaque `href`.

That leaves three options open, in increasing order of coupling:

1. **Separate domains** — the card links out. Current approach.
2. **One domain, path-based** — Next.js `rewrites` proxy `/<app>` to the app's
   deployment.
3. **Multi-zones / Vercel Microfrontends** — separate projects, one domain,
   shared routing config.

Moving between them is a change to the `href` values plus routing config, not a
change to the dashboard.

## Still open

- Framework for apps other than the dashboard.
- Whether apps stay in `apps/` or move to separate repositories — this decides
  whether shared packages stay `workspace:*` or get published to a registry.
- Which routing option above to commit to, once a real app is deployed.
- Build orchestration (Turborepo or plain pnpm scripts), now that one package
  builds and more will.

## Status

One app: `konstruct-dashboard`, the shell. It lists a static set of apps and
filters them by name. The apps it points at do not exist yet — every `href` is
still `#`.
