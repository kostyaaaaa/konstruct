# dota-bet-analytics

The backend. Discovers live tier 1–2 Dota 2 professional matches, snapshots
them, scores both teams, and serves the result to
[dota-bet-analytics-console](dota-bet-analytics-console.md).

What is planned next: [dota-bet-analytics-todo.md](dota-bet-analytics-todo.md).

Everything described here works. [Current state](#current-state) lists what is
verified and what is still only partly done.

## Purpose

Betting analytics for professional Dota 2. It watches every tier 1 and tier 2
match that is live right now, records what is happening in it, and produces a
score for each side from how the ten players historically perform on the heroes
they are playing.

The snapshot archive is the point. It cannot be recreated later, so collecting
it correctly matters more than anything built on top of it.

## Entry point

`http://localhost:4001` in dev. An HTTP API, not a page — the console is the
thing you look at.

- `GET /health` — liveness. Touches nothing external, so a failure means the
  process is gone rather than that a query was slow.
- `GET /workers` — every worker and whether it is running or paused.
- `POST /workers/:name/pause` and `POST /workers/:name/resume` — the control
  screen. An unknown name is a 404, not a silently created row.
- `GET /discovery/status` — worker health: paused, last poll, last success,
  last error, how many games the feed returned, how many survived the tier
  filter, and how many snapshots the last poll wrote.
- `GET /matches/live` — the registry's currently live matches.
- `GET /matches/recent` — the last 50 by most recently seen.
- `GET /snapshots/:matchId/series` — trimmed time series for a graph: net
  worth, score, both clocks. No raw payloads.
- `GET /snapshots/:matchId` — full snapshots including the raw payload.
- `GET /predictions` — the 50 most recent, full payload.
- `GET /predictions/:matchId` — one prediction, enough to rebuild the whole
  report as a page.
- `GET /predictions/accuracy?minMarginPercent=N` — accuracy over settled
  predictions. The threshold is a parameter, not a constant.
- `GET /backfill/status` — when the winner backfill last ran and what it found.
- `POST /backfill/run` — run a batch now instead of waiting for the tick.
- `GET /logs?level=&service=&hours=&limit=` — recent events read back from
  Axiom. Reports itself unavailable when no query token is configured.

## Owns

- **Match discovery.** Which professional matches are live, filtered to tier 1
  and 2.
- **The snapshot archive.** Append-only time-series of in-game state.
- **The score.** Two numbers per match, radiant and dire, from player-hero win
  rates weighted against hero familiarity.
- **The report.** A Telegram rich message posted per newly analysed match.
- **The professional player list.** `pro_players`, synced from OpenDota, so a
  roster can show the name a player is known by rather than their Steam name.

## Uses

- **NestJS 11** and **TypeScript 7**, ESM. Nest's dependency injection needs
  decorator metadata, so `experimentalDecorators` and `emitDecoratorMetadata`
  are on in `tsconfig.json` — without them injection fails at runtime instead
  of at compile time.
- **MongoDB Atlas** through mongoose.
- **Steam Web API** for live discovery — `GetLiveLeagueGames`, which is the only
  free feed that actually covers the professional circuit.
- **OpenDota** for league tier and post-match backfill. No key needed.
- **`@konstruct/logger`** — `src/logger/` bridges Nest's own logger onto it, so
  framework messages and application messages land in the same Axiom dataset
  with `service: 'api'` attached.
- `@konstruct/eslint-config/nest`; Prettier from the root. The `/nest` layer
  exists because the default `consistent-type-imports` rule breaks Nest's
  dependency injection — see [code-style.md](../rules/code-style.md).

## Run

```bash
pnpm dev dota-server                       # the API alone, watched
pnpm dev dota                              # with the console
pnpm --filter dota-bet-analytics build
pnpm --filter dota-bet-analytics start
pnpm --filter dota-bet-analytics lint
pnpm --filter dota-bet-analytics typecheck
```

There is a build step: `dev` and `start` run `dist/main.js`, so `build` (or
`build:watch`) has to have run first. Decorator metadata cannot be produced by
Node's built-in type stripping, so the compile is not optional.

## Configuration

Secrets live in the `Konstruct` Infisical project, `/dota-bet-analytics`.
Every variable is validated at startup by `src/config/env.schema.ts` — a
missing one lists every problem at once and refuses to boot.

**dev and prod are separate databases on the same Atlas cluster**, split by
`DB_NAME`. One cluster keeps it inside the free tier; separate names stop local
testing from writing fake matches and predictions into production, and from
posting reports about them to the channel.

| Variable             | What it is                                                     |
| -------------------- | -------------------------------------------------------------- |
| `ENV`                | `dev` or `prod` — tags every log event                         |
| `PORT`               | `4001`                                                         |
| `DB_HOST`            | MongoDB Atlas host                                             |
| `DB_USER`            | MongoDB user                                                   |
| `DB_PASSWORD`        | MongoDB password                                               |
| `DB_NAME`            | `dota-bet-analytics` in dev, `dota-bet-analytics-prod` in prod |
| `STEAM_API_KEY`      | Steam Web API key, server-side only                            |
| `OPENDOTA_API_URL`   | Defaults to the public API; no key                             |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather                                      |
| `TELEGRAM_CHAT_ID`   | Channel id, or `@channelusername`                              |
| `CONSOLE_URL`        | Optional. Where the report's "View match" link points          |
| `AXIOM_DATASET`      | `dota-bet-analytics`                                           |
| `AXIOM_TOKEN`        | Ingest token                                                   |
| `AXIOM_EDGE`         | `us-east-1.aws.edge.axiom.co`                                  |
| `LOG_LEVEL`          | Optional, defaults to `info`                                   |

## Deploy

**Railway.** It needs a host that keeps a process alive: the workers are
in-process timers, so if nothing is running, nothing polls and nothing is
archived.

**Vercel cannot host this** — its functions are request-scoped and killed when
the response is sent, so nothing holds a polling loop open, and Vercel Cron's
one-minute floor is too coarse for snapshots. The console deploys to Vercel
separately and calls this over HTTP.

Settings for the Railway service:

| Setting        | Value                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| Root Directory | the repository root, **not** `apps/dota-bet-analytics`                     |
| Build command  | `pnpm install --frozen-lockfile && pnpm --filter dota-bet-analytics build` |
| Start command  | `pnpm --filter dota-bet-analytics start:prod`                              |
| Health check   | `/health`                                                                  |

The root directory has to be the repository root because this is a pnpm
workspace: `@konstruct/logger` is linked from `packages/`, and an install run
inside the app folder alone cannot resolve it.

**`start:prod` exists because `start` will not work there.** `start` wraps the
process in `infisical run`, which is a local-development convenience — the CLI
is not installed in the container and does not need to be. Railway injects
environment variables itself, so `start:prod` is a plain `node dist/main.js`.

Every variable from [Configuration](#configuration) has to be set in Railway's
own variables, with the **production** values. Railway sets `PORT` itself, so
leave that one out and let it win.

### Cost

Measured at **55 MB resident** and near-zero CPU while polling. On Railway's
per-second rates that is about **$1.40 a month** for an always-on service,
inside the $5 Hobby plan with room to spare. The Free plan's $1 monthly credit
is not enough for anything always-on.

The database stays on Atlas rather than moving to Railway: a MongoDB service
there would add roughly $3.90 a month and push the total past the included
credit, and Atlas's free tier is a managed database with backups.

## Notes

### Discovery uses Steam, not OpenDota `/live`

OpenDota's `/live` is not a professional feed. It returns the top ongoing games
by average MMR and spectator count, which during a big event happens to be full
of tournament games — and the rest of the year is high-MMR pubs. Matches from
Majors and league play never reliably appear.

`GetLiveLeagueGames` returns every in-progress ticketed league match instead.
The trade is the opposite problem: it returns far too much. A sample run gave
49 live matches, of which 47 were amateur leagues.

### Tier comes from OpenDota, and it is the whole filter

Valve's feed carries no tier. OpenDota's `/leagues` does — `premium` (tier 1),
`professional` (tier 2), `excluded`, `amateur`. Joining the two and keeping only
`premium` and `professional` cut that sample of 49 matches to 2.

This is why STRATZ is not a dependency. Tier was the only thing it was needed
for, and OpenDota provides it without a token or a terms-of-service question
about a betting-adjacent product.

### `GetRealtimeStats` is unreachable, and unnecessary

The obvious design polls `GetLiveLeagueGames` for discovery and
`GetRealtimeStats` for detail. That does not work: `GetRealtimeStats` needs a
`server_steam_id`, and **that field is no longer in the `GetLiveLeagueGames`
response**. Driving it from `lobby_id` instead returns HTTP 400.

It does not matter, because each match in the discovery response already
carries a `scoreboard` — `duration`, `roshan_respawn_timer`, and per side
`score`, `tower_state`, `barracks_state`, `picks`, `bans`, `players`,
`abilities`, with `net_worth`, `gold`, `level` and items per player.

So there is **no separate snapshot worker**. One poll fetches once and two
consumers read it: the registry and the archive. A second worker would only
call the same endpoint again, and this halves the API budget.

The cost is that snapshot density is tied to the discovery interval, which is
10 seconds. Valve refreshes roughly every 6–9 seconds, so this captures most
updates. It costs about 8,600 calls a day against a ~100k limit, and the calls
are per poll rather than per match, so concurrent matches during a Major do not
multiply it.

### Pausing stops the work, not the process

The process always runs. `POST /workers/discovery/pause` writes `paused` to the
`worker_state` collection, and the poll checks that state on every tick.

There is deliberately no endpoint that stops the process: if it stopped,
nothing would be left running to start it again, and you would need a second
always-on service just to restart the first.

The state is in the database rather than in memory so it outlives a restart —
otherwise a deploy would silently resume a worker somebody had deliberately
stopped. A worker with no row is treated as running, because the snapshot
archive cannot be backfilled and silence is the more expensive failure.

### Broadcast delay is reported, and it is large

Each match carries `stream_delay_s`. Observed values ranged from 120 to 900
seconds in a single sample. Nothing here can assume parity with a live betting
market, and the delay is worth storing per snapshot rather than assumed
constant.

### Reading logs needs a different token from writing them

`AXIOM_TOKEN` can only ingest — asking Axiom to query with it returns 403.
Reading requires `AXIOM_QUERY_TOKEN`, which is a separate token with read
scope, and it stays on this server: the console asks the API, and the API asks
Axiom. Neither token ever reaches a browser.

The variable is optional. Without it `/logs` answers `available: false` with
the reason, rather than failing — the app still runs, the screen just says why
it is empty.

**Axiom flattens nested objects into dotted column names.** The logger's
`fields.env` comes back as a column called exactly `fields.env`, not as a
`fields` object containing `env`. Reading it as a nested object silently yields
`undefined`, and filtering on a dotted name needs bracket notation in APL:
`where ['fields.service'] == "api"`. Both are easy to get wrong without
noticing, because the query still succeeds and simply returns blank columns.

### A prediction records the delay it was made under

Each live game carries a `stream_delay_s`, and the scoreboard appears to arrive
on that same delayed timeline — a 900-second league gives us the draft a quarter
of an hour after it was picked. `streamDelaySeconds` is stored on the
prediction and shown in both the report and the console, because it is the
difference between a pick made at draft time and one made fifteen minutes into
the game.

The limitation itself, the measurements behind it, and what might be done about
it are in [dota-bet-analytics-todo.md](dota-bet-analytics-todo.md).

### Steam names are not player names

The account playing in a match is identified by its Steam persona, which is
whatever the player has set — `♦`, `failure`, `Мечта.`. `ProPlayersService`
syncs OpenDota's registered professional list daily into `pro_players`, and a
prediction stores the nickname alongside the Steam name.

Both are kept. The Steam name identifies the account; the nickname is what the
player is called. Not everyone resolves — a tier 2 league has unregistered
players — so the Steam name stays as the fallback rather than being replaced.

### The report goes to Telegram, because there is no domain to send from

Every email provider requires a **verified sending domain** — DNS records
proving you own it. This app is deployed on `vercel.app` and `railway.app`
subdomains, whose DNS we do not control, so there is nothing to verify.

Expect a provider to accept the API call and report success, then fail delivery
separately: the send is asynchronous, so an unverified domain looks like a
working integration right up until nothing arrives. Buying a domain is the only
thing that changes this.

A Telegram bot needs no domain, no DNS and no sending reputation, and cannot be
filtered into a spam folder. Railway's SMTP block below the Pro plan is
irrelevant too, since this is an ordinary HTTPS call.

**Rich messages, not plain text.** Bot API 10.1 added typed blocks — headings,
lists, quotes, dividers. `rich-message.ts` types the slice used here;
`report.builder.ts` assembles the blocks.

**The message is short on purpose: the call, and how far to trust it.** Five
lines — who is favoured and by how much, the two scores, how past calls at that
confidence turned out, any reliability warning, and a footer with the league,
the delay and a link to the match.

**The rosters are not in it**, and both ways of including them were tried on a
phone. A table crops, because its columns are fixed and do not reflow. A list
wraps correctly but ten players make twenty lines, which buries the one
sentence worth reading. The console already renders the full rosters properly,
and the footer link opens that match directly — so the detail is one tap away
rather than in the way.

Blocks are built as **structured JSON, not HTML or Markdown**, although
Telegram accepts all three. Player names contain characters that are syntax in
both — one roster genuinely included `⃤⃟⃝⃤⃟⃝⃤`, `&nbsp;`, `.` and `Ankou ♡`.
Escaping those correctly every time is a bug waiting to happen; JSON string
fields need no escaping at all.

Telegram rejects an over-long message rather than truncating it, so the builder
counts blocks against the documented ceilings before sending. A real match uses
about 23 of the 500 allowed.

**A block's `type` string is not its class name.** `InputRichBlockBlockQuotation`
sends `"blockquote"`, `InputRichBlockSectionHeading` sends `"heading"`, and
`InputRichBlockPreformatted` sends `"pre"`. Read the "always ..." value in each
class's `type` field rather than deriving it, or the API answers
`can't parse InputRichBlock: type "..." is unsupported`.

### The report is sent after the poll, not inside it

`DiscoveryService.poll` runs on a 10-second interval and guards against
overlapping itself with a flag. Anything awaited while that flag is held stops
discovery — and an unreachable API takes as long as its timeout to fail, which
is far longer than the interval.

So `runPoll` returns the predictions it made, and the reports are sent after
the flag is released. A slow provider then delays only the report.
`ReportService.send` reports its own failures and never throws, so nothing
escapes into an unhandled rejection.

### Current state

Working:

- NestJS boots, serves `GET /health`, and logs through Axiom with
  `service: 'api'`.
- Environment validated at startup — a missing variable lists every problem and
  refuses to boot.
- Mongo connected through `@nestjs/mongoose`.
- **Reference data syncs.** `heroes` (127) from Steam and `leagues` (10,036, of
  which 2,681 are tier 1–2) from OpenDota, seeded when empty and re-synced
  daily.
- **The unknown-hero trigger works.** A hero id that is not in the collection
  causes one sync and a retry. It is guarded by a single-flight lock and a
  five-minute cooldown, so a genuinely bad id cannot make ten heroes in one
  match fire ten syncs.
- **The discovery worker runs.** Polls `GetLiveLeagueGames` every 20 seconds,
  keeps only tracked leagues, and maintains the `live_matches` registry.
  Verified against the live feed: 26 games returned, 2 kept, both registered
  with their series score and stream delay. Re-polling does not duplicate a
  match or move its `startedAt`, and a match that leaves the feed is marked
  `ended` on the next poll.

- **Snapshots accumulate.** Every poll appends one row per live match to
  `match_snapshots`, with a unique index on `(matchId, capturedAt)`. Verified
  over three polls of a real match: net worth and score advanced, picks, bans,
  tower bitmasks, Roshan timer and the raw payload all stored. Writing the same
  poll twice is rejected by the index, logged as a warning, and does not stop
  the rest of the batch.

- **Pause and resume work, and survive a restart.** Verified end to end:
  pausing froze `lastPollAt` across several ticks; pausing, killing the process
  and starting it again came back with `paused: true` and `lastPollAt: null`,
  so the fresh process never polled; resuming started it again. An unknown
  worker name returns 404.

- **The scoring is ported, and the whole payload is stored.** Verified against
  ten real players: 20 OpenDota calls in 3.2s at concurrency 3, producing
  `235.87 vs 215.12`, `favoured: radiant`, `marginPercent: 8.8`,
  `complete: true`, with all ten players kept — name, hero, portrait, win rate,
  familiarity rank, games played and leaderboard rank.

- **Winner backfill runs.** Every five minutes it takes up to ten predictions
  with no result, asks OpenDota only about matches the registry says have
  ended, and records the winner and whether the call was right. Verified
  against three real finished matches, including one where the same team won
  from the other side. Pausable like discovery.

- **The report posts to Telegram, and is unverified in production.** Each new
  prediction is posted as well as stored. The message builder is tested against
  real stored predictions, but nothing has been delivered to a channel yet.

Everything planned for the backend is built.

The `matches` collection holds 18 rows from September 2025, none with a winner
recorded, and several with a score of `0` — the signature of the swallowed-error
problem above. An older archive of 234 scored matches exists on a different
Atlas cluster and is not in use.
