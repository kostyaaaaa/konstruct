# Infrastructure

Every external service and every core dependency the platform runs on, across
all apps.

**Core only.** A package is listed here when choosing it was a decision. What
comes with it is not: React is here, `react-dom` is not; NestJS is here, `rxjs`
and `reflect-metadata` are not, even though Nest cannot run without them. If
you would not argue about it in a review, it does not belong here.

Per-app detail — which variables, which settings — lives in that app's document
under [docs/apps/](../apps/README.md).

## Services

| Service                           | What it does                 | Plan            | Used by            |
| --------------------------------- | ---------------------------- | --------------- | ------------------ |
| [Railway](#railway)               | Hosts long-running processes | Hobby, $5/month | dota-bet-analytics |
| [Vercel](#vercel)                 | Hosts the Next.js apps       | Hobby, free     | both frontends     |
| [MongoDB Atlas](#mongodb-atlas)   | The database                 | Free tier       | dota-bet-analytics |
| [Infisical](#infisical)           | Secrets                      | Free tier       | everything         |
| [Axiom](#axiom)                   | Logs                         | Free tier       | everything         |
| [Telegram](#telegram)             | Posts the prediction report  | Free            | dota-bet-analytics |
| [GitHub Actions](#github-actions) | CI on push and pull request  | Free            | the repository     |

Two external APIs are read but not paid for: **Steam Web API**
(`GetLiveLeagueGames`, needs a key) and **OpenDota** (league tiers, player hero
stats, finished matches — no key).

### Railway

For anything that has to stay alive. The workers are in-process timers, so a
platform that runs code per request cannot host them.

**Outbound SMTP is blocked below the Pro plan** — ports 25, 465, 587 and 2525.
Packets are dropped rather than refused, so a mail library waits out its full
timeout and reports what looks like a broken mail server. Nothing here sends
mail any more, but the constraint stands for anything that might.

### Vercel

For the Next.js apps. One project per app, with **Root Directory** set to the
app's folder, so the monorepo deploys as separate projects rather than one.

Builds run without Infisical, so `build` must not be wrapped in `infisical run`
— the variables have to exist in the Vercel project itself.

### MongoDB Atlas

One cluster, shared by dev and prod and split by database name. One cluster is
what keeps it inside the free tier; separate names stop local work touching
production data.

The free tier's storage limit is the reason the snapshot archive stores its raw
payload once per match rather than once per snapshot.

### Infisical

One project, `Konstruct`, with a folder per app crossed with `dev` / `staging`
/ `prod`. Secrets are injected by `infisical run`; nothing is committed, and
there is no `.env.example` — an app's variables are listed in its document.

`.infisical.json` at the repo root links the workspace to the project and holds
no secrets.

**Secret Syncs push to the hosts.** A sync is configured per destination
project, and once it exists, adding or changing a secret propagates
automatically — new keys included, not only edits to existing ones. A new app
needs its own sync; nothing is inherited.

The apps read `process.env` once at startup, so a new value takes effect on the
next restart, which the host does itself when its variables change. Deploying
code that requires a new variable therefore means letting the sync land first,
or startup validation exits the process.

### Axiom

One dataset per app, named after the app, holding every environment and
separated by the `env` field. No app writes log files, and no app talks to
Axiom directly — [`@konstruct/logger`](#core-packages) wraps it.

Writing and reading need different tokens: `AXIOM_TOKEN` ingests,
`AXIOM_QUERY_TOKEN` runs the queries behind the console's logs screen.

### Telegram

The prediction report is posted to a channel by a bot, over the ordinary HTTPS
Bot API. Free, with no quota worth tracking at this volume.

**This replaced email because there is no domain to send from.** Every email
provider requires a verified sending domain, and the deployment lives on
`vercel.app` and `railway.app` subdomains whose DNS we do not control. A bot
needs no domain, no DNS, no sending reputation, and cannot be spam-filtered.

Setup is a bot from `@BotFather`, added to the channel as an administrator with
permission to post. Its token and the channel id are the only configuration.

Rich messages — typed blocks, so a table is a real table — arrived in Bot API
10.1. The documented ceilings are 32,768 characters, 500 blocks, 16 levels of
nesting, 50 media attachments and 20 table columns.

### GitHub Actions

`install → format:check → lint → lint -r → typecheck -r → build -r` on every
push to `main` and every pull request. It exists because **neither Railway nor
Vercel runs ESLint or Prettier** — their builds run `tsc`, so a type error
already blocks a deploy, but code failing lint would deploy happily.

## Core packages

### Everywhere

| Package                     | Why                                             |
| --------------------------- | ----------------------------------------------- |
| **pnpm**                    | Package manager and workspaces. Node >= 22.     |
| **TypeScript 7**            | Every app and package.                          |
| **ESLint 9**                | Flat config. Shared through the packages below. |
| **Prettier 3**              | Formatting, shared the same way.                |
| **husky** + **lint-staged** | Runs both on `pre-commit`, staged files only.   |

### Backend — dota-bet-analytics

| Package              | Why                                                               |
| -------------------- | ----------------------------------------------------------------- |
| **NestJS 11**        | Structure for an app with many endpoints and workers.             |
| **@nestjs/schedule** | The workers. In-process intervals, not an external scheduler.     |
| **mongoose**         | MongoDB models and schemas.                                       |
| **zod**              | Validates environment variables at startup and input at the edge. |
| **@axiomhq/js**      | Reads logs back for the console. Writing goes through the logger. |

HTTP calls use the platform `fetch`, wrapped in `src/common/http.ts` for
timeouts, bounded retries and reporting. There is no HTTP client library.

### Frontend — konstruct-dashboard, dota-bet-analytics-console

| Package            | Why                                                       |
| ------------------ | --------------------------------------------------------- |
| **Next.js 16**     | App Router. Server components by default.                 |
| **React 19**       | Comes with Next.js, but the version is a decision.        |
| **Tailwind CSS 4** | Styling. Design tokens live in `@theme` in `globals.css`. |
| **@svgr/webpack**  | Turns `src/assets/icons/*.svg` into React components.     |
| **server-only**    | Fails the build if a server module reaches a client one.  |

### Shared — packages/

| Package                      | What it holds                                                  |
| ---------------------------- | -------------------------------------------------------------- |
| `@konstruct/eslint-config`   | `./base`, `./nest`, `./next`, `./node`                         |
| `@konstruct/prettier-config` | One config, re-exported by each app                            |
| `@konstruct/tsconfig`        | `base.json`, `nest.json`, `next.json`                          |
| `@konstruct/logger`          | Axiom + console. `./server` holds the token, `./client` cannot |

## Deliberately not used

Absence here is a decision, not an oversight. Adding one of these is fine — but
know you are reversing something.

- **No test runner.** Nothing is tested anywhere. This is the largest known gap
  in the repository, not a preference.
- **No email at all.** No SMTP library, and no mail provider. The report goes
  to Telegram instead — see above for why.
- **No template engine.** The report is built as typed blocks in code.
  Handlebars went with the HTML email it existed for.
- **No HTTP client library.** `fetch` plus the shared wrapper covers it.
- **No charting library.** The net worth graph is inline SVG.
- **No UI component library.** Tailwind and hand-written components.
- **No build orchestration.** Plain pnpm scripts; Turborepo is still open.
- **No container registry or Dockerfile.** Both hosts build from the repo.
