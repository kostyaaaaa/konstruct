# dota-bet-analytics-console

The frontend for [dota-bet-analytics](dota-bet-analytics.md). Shows what the
workers are doing, the matches being tracked, the predictions and how well they
have held up — and lets you pause and resume the workers.

What is planned next: [dota-bet-analytics-console-todo.md](dota-bet-analytics-console-todo.md).

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
| `/logs`             | Recent Axiom events, filtered by level and environment          |

## Owns

Nothing. It holds no database and no state — every page is a read of the API,
and the two writes (pause/resume, run backfill) are server actions that post
to it.

## Uses

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.
- The dota-bet-analytics API, at `API_URL`.
- **`@konstruct/logger`** — `src/lib/logger.ts`, server side only. See
  [Only the writes are logged](#only-the-writes-are-logged).
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
| `AXIOM_TOKEN`     | Ingest token for that dataset             |
| `AXIOM_EDGE`      | `us-east-1.aws.edge.axiom.co`             |
| `NEXT_PUBLIC_ENV` | Same as `ENV`, readable from browser code |

**Without `AXIOM_TOKEN` the console still runs**, and logs to stdout only —
which on Vercel means the events are gone the moment the function is recycled.
The logger warns about it at startup when `NODE_ENV` is `production`.

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

**The rule is that no figure needs hydration to be readable**, not that no
JavaScript may exist. Two components are client components because they cannot
be anything else: `Nav`, which reads the current path to mark the active tab,
and `AutoRefresh` below.

### Every screen refreshes itself every 10 seconds

`AutoRefresh` sits in the layout and calls `router.refresh()` on a timer. Every
screen reports something that is true _right now_ — a worker's state, a live
match, the last poll — and stale numbers presented as current are worse than no
numbers.

`router.refresh()` re-runs the server components and swaps in the new output.
It is not a page load: scroll position, focus and open state all survive, which
a `<meta http-equiv="refresh">` would not.

It skips the tick when the tab is hidden, and catches up when it becomes
visible again. Without that, a console left open overnight would poll the API
about 8,000 times for output nobody is looking at.

### Players are shown by their competitive nickname

The roster prefers `proName` and falls back to `personaName`. The second is
only the Steam display name — the account called `♦` belongs to **bb3px**, and
`failure` is **yowaai** — so the fallback is a last resort, not the default.

Not every player resolves. The nickname comes from OpenDota's registered
professional list, and a tier 2 league has players who are not on it. Measured
on a real match: nine of ten. The tenth keeps their Steam name, which is
correct rather than a failure, and the tooltip says which kind of name is being
shown.

### One breakpoint, at 640px

Everything responsive uses Tailwind's `max-sm:` prefix and nothing else. A
console read on a phone and on a laptop does not need a scale of sizes — it
needs one layout that stops overflowing.

Below 640px: the header loses the "Konstruct" wordmark and tightens its
padding, the nav shrinks, stat grids drop to two columns, rosters to one, and
every row that was a left-and-right pair wraps so the right-hand side sits
under the left rather than being squeezed. Log rows put the message and the
context on their own full-width lines.

The rule for a new row: if it is `justify-between` with content on both sides,
it needs `flex-wrap` and the right-hand side needs `max-sm:text-left`, or it
will crush on a phone.

### Three colour meanings, three hues

Green and red carry two meanings already — Radiant and Dire, and correct and
wrong. A prediction favouring Dire that turned out right showed a red team name
next to a green "correct", which reads as a contradiction.

So **favoured is the accent purple**, everywhere it appears: the badge and score
on the roster, and the team name in the predictions list. Nothing else uses the
accent for meaning, so it cannot be confused with a side or an outcome.

The match page states who won and stops there. Whether that made the prediction
right is on the predictions list, where "correct" and "wrong" are words rather
than colours on a team name.

### Tooltips are native `title` attributes

Every figure is explained on hover through the `Hint` component, which sets a
`title` and marks the text with a dotted underline.

A positioned tooltip would have to measure itself and flip near the viewport
edge — client JavaScript in an app that otherwise ships none — and would be
clipped by the panels' rounded corners. The browser's own tooltip has neither
problem and works before hydration.

`Hint` is for anything the reader has to be told; a plain `title` is enough for
text that already explains itself, like a status word.

### Only the writes are logged

The console logs three events, all of them user-initiated writes: pausing a
worker, resuming one, and asking for a backfill run. Nothing else.

Every other thing the console does is a read, and the API has already recorded
that work from its own side — logging it again would put the same event in two
datasets and make counting anything a matter of remembering which one to trust.
A write is different: a paused worker looks exactly like a broken one, and
without a line here there is no record that a person asked for it.

Each action logs whether the API accepted it, with the status code when it did
not. A 404 from a renamed worker and an unreachable API are otherwise the same
silent failure.

**Every action flushes before it returns.** Axiom sends in batches and Vercel
freezes a function the instant it responds, so an unflushed event is lost
without a trace. That is why the actions `await flushLogs()` rather than
letting the batch drain on its own.

There is no `/api/logs` route and no client logger, because nothing logs from
the browser. Add both together if that ever changes — the client logger posts
to that route and does nothing without it.

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

Its colour follows who led at each moment, so the line is split wherever it
crosses zero and each run drawn in that side's colour. Colouring the whole line
by the final value is simpler but misleading: a match that was even for twenty
minutes reads as one-sided from the first minute. The crossing point is
interpolated, so the two colours meet exactly on the zero line.

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

### The logs screen has no debug tab

The level filter is cumulative — each level shows itself and everything above
it — so a `debug` tab could only differ from `info` by including debug lines.
The backend leaves `LOG_LEVEL` at `info` and therefore emits none: a week of
the dataset held 1,720 info, 39 warn, 16 error and **zero** debug. The tab was
the info tab under another name.

The API still accepts `level=debug`. Raising `LOG_LEVEL` on a machine that
wants the per-poll detail still works; it just has no shortcut in the UI.

### The logs screen holds no token

It calls the API's `/logs`, and the API queries Axiom with `AXIOM_QUERY_TOKEN`.
That token is separate from the ingest token and never leaves the API server.
Until it is set, the page shows why it is empty instead of erroring.

### Predictions are filtered by confidence and by tournament

Two filters, and they combine — switching tournament keeps the margin, and the
other way round. Both live in the Accuracy panel and both narrow the list
below it as well as the figures above it, so what is counted and what is shown
never disagree.

**Tournament is a filter because pooled accuracy is misleading here.** Leagues
are tracked on prize money, which admits small events alongside serious ones.
Averaging them produces a number that describes neither, and one weak
tournament can bury a strong one. Each tournament pill carries its own settled
record for the same reason.

The pill is a league id in the URL, not a name. Names arrive from OpenDota with
stray whitespace and are edited mid-tournament; the id does not move. Names are
trimmed on display only.

A match page links its tournament back to that filtered list, so "how has the
model done at this event" is one click from any match.

### Thin-record matches are hidden by default

A third filter, next to margin and tournament: matches where two or more
players on a side had under five games on their picked hero. It starts **on**,
so the default view is the trustworthy one.

Like the others it is a link, not an `input` — every filter on this page is a
URL, which keeps the screen a server component and makes any view shareable.
Only the non-default state reaches the URL, so a bare `/predictions` is the
filtered view rather than the raw one.

A hidden match is not deleted or unreachable. It still has its own page, still
shows in the tournament counts when the box is unticked, and is marked `thin
records` in the list so the reason is visible rather than implied.

### A live match says whether it is scored, not when it will be

Two states: `predicted`, and `awaiting prediction`.

There is no countdown, and that is a decision rather than an omission. The wait
for the delayed scoreboard can be timed to within a poll; the draft after it
cannot, and one pick-and-ban in ten runs past fifteen minutes. A single figure
covering both would read as precise and be wrong often enough to stop being
worth reading.

### The draft is shown on its own, not just folded into the score

`heroMatchup` is 0.40 of a team's score but was invisible — the roster showed
each player's win rate and games, and the one number about the _draft_ was
missing.

Each side now shows it twice over: as a signed figure against an even draft
(`+1.65`) with the raw value beside it, and as one line in the prediction
header naming the side whose heroes counter the other's.

Signed, because the raw values sit between about 45 and 55 and the eye reads
`51.65 vs 48.35` as two similar numbers rather than as a gap. The two always
add up to 100 — one side's advantage is the other's disadvantage.
