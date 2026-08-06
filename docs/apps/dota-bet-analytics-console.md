# dota-bet-analytics-console

The frontend for [dota-bet-analytics](dota-bet-analytics.md). Shows what the
workers are doing, the matches being tracked, the predictions and how well they
have held up — and lets you pause and resume the workers.

## Purpose

An operations console for one person. It has no accounts, no writes of its own,
and no data: everything comes from the API over HTTP.

## Entry point

`http://localhost:4000` in dev.

| Route               | What it is                                                      |
| ------------------- | --------------------------------------------------------------- |
| `/`                 | Control — worker status, pause and resume, discovery health     |
| `/matches`          | Live and recently ended matches                                 |
| `/matches/:matchId` | Net worth graph, and the prediction with both full rosters      |
| `/predictions`      | Every prediction, and accuracy at a chosen confidence threshold |
| `/logs`             | Recent Axiom events, filtered by level                          |

## Owns

Nothing. It holds no database and no state — every page is a read of the API,
and the two writes (pause/resume, run backfill) are server actions that post
to it.

## Uses

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- The dota-bet-analytics API, at `API_URL`.
- `@konstruct/eslint-config/next`; Prettier from the root.

## Run

```bash
pnpm dev dota-console                               # http://localhost:4000
pnpm dev dota                                       # with its API
pnpm dev dashboard, dota, console                   # everything at once
pnpm --filter dota-bet-analytics-console build
pnpm --filter dota-bet-analytics-console lint
pnpm --filter dota-bet-analytics-console typecheck
```

The API has to be running, or every panel shows an "API unreachable" message
instead of blanking the page.

## Configuration

`/dota-bet-analytics-console` in the `Konstruct` Infisical project.

| Variable          | What it is                                |
| ----------------- | ----------------------------------------- |
| `ENV`             | `dev` or `prod`                           |
| `PORT`            | `4000`                                    |
| `API_URL`         | Where the API lives                       |
| `AXIOM_DATASET`   | `dota-bet-analytics-console`              |
| `NEXT_PUBLIC_ENV` | Same as `ENV`, readable from browser code |

## Deploy

Vercel, **Root Directory** `apps/dota-bet-analytics-console`. `build` stays
outside `infisical run` so Vercel and CI can build without an Infisical login;
the variables have to exist in the Vercel project as well.

`API_URL` will need to point at wherever the API is hosted — Railway or
Fly.io — not at localhost.

## Notes

### `API_URL` is not public, and the build enforces that

`src/lib/api.ts` starts with `import 'server-only'`. If that module is ever
imported into a client component, **the build fails** rather than quietly
shipping the API's address to the browser.

That is why pause, resume and run-backfill are server actions rather than a
`fetch` in an `onClick`: the browser posts to the Next server, and the Next
server talks to the API. The browser never learns where the API is.

### No client JavaScript for the interactive parts

The worker switches are plain `<form>` elements posting to server actions, and
the accuracy threshold is a set of links that change a query parameter. Both
work without hydration, which for a console that mostly displays numbers is
simpler than managing client state.

### Every page is dynamic

Each route sets `dynamic = 'force-dynamic'` and every fetch uses
`cache: 'no-store'`. A cached "worker is running" would be worse than a slow
page — this exists to tell you the truth about right now.

A failed request returns `null` instead of throwing, so one dead endpoint
degrades a single panel rather than taking down the page.

### The graph is plotted against in-game time

`NetWorthChart` uses `gameTime`, not `capturedAt`. Pauses are frequent in pro
play, and plotting against wall clock would stretch a pause into a slope that
never happened. It is inline SVG — no charting library.

### The console mark exists in three files, on purpose

The hexagon-with-a-check appears in the header, on the dashboard's card for this
app, and as the browser tab icon. Each place needs a different file:

| File                                                 | Used as                    | Colour         |
| ---------------------------------------------------- | -------------------------- | -------------- |
| `src/assets/icons/console.svg`                       | the header, through `Icon` | `currentColor` |
| `apps/konstruct-dashboard/src/assets/icons/dota.svg` | the dashboard card         | `currentColor` |
| `src/app/icon.svg`                                   | favicon and tab icon       | hard-coded hex |

The first two are the same geometry in two apps because an app cannot import
another app's assets. The favicon is separate because it renders outside the
page: it has no CSS and cannot read the `oklch` tokens, so its canvas and accent
colours are written as hex and have to be kept in step with `globals.css` by
hand.

Changing the mark means editing all three.

### The logs screen holds no token

It calls the API's `/logs`, and the API queries Axiom with `AXIOM_QUERY_TOKEN`.
That token is separate from the ingest token and never leaves the API server.
Until it is set, the page shows why it is empty instead of erroring.
