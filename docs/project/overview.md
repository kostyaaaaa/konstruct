# konstruct — overview

konstruct is a platform. A dashboard page is the entry point, and from there the
user navigates into distinct apps.

## Structure

- pnpm monorepo. Shared code lives in `packages/`, apps in `apps/`.
- The dashboard is the shell that discovers and links to those apps.
- Layout and conventions: [structure.md](structure.md).

## Decisions made

- **Package manager** — pnpm, workspaces. Node >= 22.
- **Formatting** — Prettier, shared via `@konstruct/prettier-config`, format on
  save in VSCode.
- **Linting** — ESLint 9 flat config, shared via `@konstruct/eslint-config/base`,
  JavaScript + TypeScript, framework-agnostic.
- **Git hooks** — husky + lint-staged, formatting and lint enforced on
  `pre-commit`.

## Still open

- Framework for the dashboard and the apps.
- Whether apps stay in `apps/` or move to separate repositories — this decides
  whether shared packages stay `workspace:*` or get published to a registry.
- Build orchestration (Turborepo or plain pnpm scripts), once more than one
  package needs building.

## Status

No app exists yet. `apps/` is empty; `packages/` holds tooling configs only.
