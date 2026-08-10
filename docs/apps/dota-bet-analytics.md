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
- `GET /predictions/leagues` — every tournament that has a prediction, with
  its settled record. Keyed by league id, not name: names arrive with stray
  whitespace and get edited mid-tournament.
- `GET /predictions/accuracy?minMarginPercent=N` — accuracy over settled
  predictions. The threshold is a parameter, not a constant.
- `GET /backfill/status` — when the winner backfill last ran and what it found.
- `POST /backfill/run` — run a batch now instead of waiting for the tick.
- `GET /logs?level=&service=&hours=&limit=` — recent events read back from
  Axiom. Reports itself unavailable when no query token is configured.

`GET /predictions`, `GET /predictions/leagues` and `GET /predictions/accuracy`
all take an optional `league=<id>`, which narrows them to one tournament, and
`includeSuspicious=false`, which leaves out matches built on thin hero records.
Both default to showing everything: the API describes what is stored, and the
console decides what is worth looking at. Pooled accuracy hides the
difference between an event the model reads well and one it does not, and only
some tracked events are ones a bookmaker will take a bet on.

## Owns

- **Match discovery.** Which professional matches are live, filtered to tier 1
  and 2.
- **The snapshot archive.** Append-only time-series of in-game state.
- **The score.** A probability that Radiant wins, from how the ten players
  perform on the heroes they picked.
- **The report.** A Telegram rich message posted per newly analysed match.
- **The professional player list.** `pro_players`, synced from OpenDota, so a
  roster can show the name a player is known by rather than their Steam name.
- **The hero matchup matrix.** `hero_matchups`, how every hero has fared
  against every other across three years of professional play.

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
| `MIN_PRIZE_POOL`     | Smallest prize pool worth tracking. Defaults to `10000`        |
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

### The score is a fitted model, not a formula someone chose

`scoring.ts` is a logistic regression whose coefficients were fitted against
81,846 tier 1–2 matches from 2023 onward, trained on 2023–24 and tested on
13,107 matches from 2025 that it never saw. It scores **58.2%** there, against
**57.0%** for the formula it replaced and **52.2%** for always picking Radiant.

It outputs a probability. The old version produced two opaque numbers whose
difference was called a margin; a probability can be checked against what
happened and compared with a bookmaker's price.

Three params, in order of weight: **hero win rate** (0.331), **hero matchup**
(0.160) and **games on the hero** (0.054). A coefficient is only valid
alongside the params it was fitted with — adding a fourth means refitting all
four, not tuning the new one.

**Team strength is deliberately absent.** A team rating measures which side is
better, which is exactly what a bookmaker prices; a model built on it agrees
with the favourite and earns short odds. This one looks only at the players and
the heroes they picked, so a disagreement with the market comes from something
the market may not have weighed. Including a rating measured 61.6% against this
model's 59.4% — about two points of accuracy, given up on purpose.

Hero synergy — how a side's own five heroes work together — was fitted and made
the model slightly worse. Its absence is a result too.

Two things changed because the data said so, and both are worth not undoing:

- **Hero familiarity is gone.** The old `100 / heroRank` term scored 51.2%
  alone and never improved as it grew more confident. It was 20% of the score
  and contributed nothing.
- **A thin record is shrunk.** One win from one game used to read as 100%; it
  now reads as 55%, and a real record still dominates by twenty games.

**Every prediction records `modelVersion`.** `marginPercent` means a different
thing under this model than the last one, so the accuracy endpoint filters on
it. Without that, two scales would be averaged and the answer would be quietly
wrong.

The reasoning, the params that were rejected, and what production still lacks —
team strength and the hero matchup matrix, both bigger wins than anything above
— are in [dota-bet-analytics-todo.md](dota-bet-analytics-todo.md).

### The matchup matrix is counted, not replayed

`hero_matchups` holds one document per hero with its record against every
other. Unlike team ratings this is **not path-dependent** — it is a count, so
the order matches were played does not matter and the database can do the
counting. That makes the rebuild a handful of aggregate queries rather than a
replay of two million pairings.

**One query per half-year, not one for everything.** The self-join needed here
exceeds OpenDota's query timeout when asked for three years at once; windowed,
each returns in about two seconds.

`games` is never queried. A pair's total is simply the number of times each
side beat the other, so it is derived after the fact rather than asked for —
which halves the work.

Each cell is shrunk toward 50% by its own sample size. Without that a 2–0
record between two rarely-picked heroes would read as a hard counter.

### The report shows its own accuracy from the first settled prediction

The Telegram message carries how past calls at this confidence turned out, with
the sample size next to it. It is shown from the very first one — `(2 settled)`
says plainly that it means nothing yet, and hiding the line until it is
trustworthy would mean never seeing whether it is working.

### Which tournaments are tracked: prize money, not tier

Discovery keeps a league when Valve reports a prize pool of at least
`MIN_PRIZE_POOL`, default $10,000.

**A tier label was tried first and did not work.** OpenDota classifies leagues
as premium, professional, excluded or amateur, and the label is reliable at the
extremes — The International is `premium` — but close to a coin flip below
that. Of eight tournaments Dotabuff lists as professional, OpenDota called four
`excluded`, including Asgard Championship and Ultras Dota Pro League.

Valve does not classify tournaments at all: there is no league listing endpoint
and no tier. Prize money is the closest thing to an objective statement it
makes about how serious an event is, and unlike a label it cannot be applied
inconsistently.

It separates cleanly. Across one evening's feed, every tournament with money
was one worth tracking and every one without was a pickup league — nine FACEIT
games, RetosDota2, Kobold League and nine others, all at zero. Of 29 live
games, 3 were kept.

Pools are fetched once per league and cached for a week, so the cost is one
call per new tournament rather than one per poll. A failed lookup falls back to
the last known value: better a stale figure than dropping a tournament over one
bad request.

The threshold is a variable, so tightening it to only the biggest events is a
config change with no deploy.

### `heroWinRate` counts pubs as well as official matches

It comes from OpenDota's `/players/{id}/heroes`, which totals **every** match
an account has played — ranked pubs, scrims and official games together. There
is no way to separate them from that endpoint; doing so would need each
player's full match history, which is ten more calls per prediction.

The mix varies wildly by player. Two pro accounts sampled: one had 83% ranked
pubs in its recent history, the other 98% non-pub. So "60% on Storm Spirit"
does not mean the same thing for both.

**This is accepted rather than tolerated.** The param is standing in for how
comfortable a player is on a hero, and a pub game counts toward that as much as
an official one does. It would be a problem if the param claimed to measure
professional performance. It does not.

A thin record is pulled toward even — `(wins + 5) / (games + 10)` — so one win
from one game reads as 55% rather than 100%. By about twenty games the real
record dominates.

### A prediction records the delay it was made under

Each live game carries a `stream_delay_s`, and the scoreboard appears to arrive
on that same delayed timeline — a 900-second league gives us the draft a quarter
of an hour after it was picked. `streamDelaySeconds` is stored on the
prediction and shown in both the report and the console, because it is the
difference between a pick made at draft time and one made fifteen minutes into
the game.

**The delay is per league, and it varies.** Sampled across 47 live games:
10s, 120s, 300s and 900s. A 10-second league is effectively live and the
prediction lands at draft time; a 900-second one does not. A big event that
chooses no delay costs nothing to support — the value is read per match and
nothing assumes it is large.

**This has been accepted, and there is nothing better available.** Checked, so
it is not re-checked:

- **OpenDota is not an earlier source.** Its `/matches/<id>` has nothing for a
  live match, its `/live` carried one league game against Steam's 49, that
  entry's `game_time` was frozen across three fetches, and it reports the same
  `delay`. It reads the same Valve game coordinator, so it inherits the same
  delay.
- **Valve's `GetRealtimeStats` exists and works**, returning far richer data
  than the league feed — but it takes a `server_steam_id`, and
  `GetLiveLeagueGames` no longer returns one. `lobby_id` and `match_id` are
  both an HTTP 400. The only public source left is `GetTopLiveGame`, ten games
  ranked by MMR, sampled eight times with usually zero league games in it.
- **Betting services do not use this API at all.** They license official feeds
  from providers with direct tournament-organiser partnerships, taken straight
  off the game server. The delay is not a technical problem they solved; it is
  applied to the public path deliberately and bypassed by contract.

If a route to a `server_steam_id` ever reappears, `GetRealtimeStats` is the
endpoint worth revisiting.

### Aggregates come from OpenDota because Valve has none

Valve's API returns **raw matches**, not aggregates. There is no Valve endpoint
for "this player's win rate on this hero" — computing it would mean pulling
match history per player and keeping a store of our own, which is a different
app, not a different URL. That is why the split is Valve for live state and
OpenDota for player and league facts.

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

### The match registry stores its league's name

`live_matches` carries `leagueName` alongside `leagueId`, copied in by
discovery from the row `resolve()` already loaded. The name is denormalised on
purpose: the console lists matches on three screens, and a join per screen per
ten-second refresh costs more than a string per row.

`resolve()` returns the tracked decision and the name together for the same
reason — it reads the whole league document either way, so asking separately
would double the queries on every poll.

A league OpenDota has not named yet is stored with its id as a placeholder.
That is treated as no name rather than passed through, so the console falls
back instead of printing the number twice.

`scripts/backfill-league-names.mjs` fills the field on rows written before
discovery set it, copying from the `leagues` collection. Safe to run twice.

### A prediction can be flagged as built on thin records

`suspicious` is set when **two or more players on either side have fewer than
five games on the hero they picked**. The prediction is still made and still
stored — this only lets it be left out of what is counted.

It is not a weaker `complete`. `complete` means a fetch failed and there is no
data. This means the fetch worked and returned almost nothing, which usually
says the account is new rather than the player: professionals appear on fresh
accounts constantly, and **no public API links those accounts back together** —
OpenDota has no such endpoint across its 55, and neither does Steam.

Shrinkage already stops one win from one game reading as 100%; it enters the
score as 54.5%. What shrinkage cannot fix is that the number is about an
account rather than a person.

Two on one side is the line because one is ordinary — a pocket pick, a hero
somebody just learned. Two means half a draft is unreadable, and that side's
mean win rate is then mostly the shrinkage constant. It is `either side`, not
both: the score is a comparison, so one unreadable side spoils it.

**On the first 72 predictions the flag pointed the wrong way.** Flagged matches
were called right 5 times out of 6; everything else, 19 of 43. Six is far too
small to mean anything, and the plausible reading is that a side fielding two
unknown accounts is genuinely weaker — the model predicts against them and is
right. Worth re-checking once the sample is real, because if it holds, the flag
is better used as a signal than as an exclusion.

`scripts/backfill-suspicious.mjs` recomputes the field for rows written before
it existed. It imports the rule from the build rather than copying it, and it
is safe to run twice.

### A match ends after three missed polls, not one

Discovery ends a live match only when it has been absent from **three
consecutive successful polls**, about thirty seconds. The count lives on the
match document, so a restart cannot reset a run half way through and leave a
finished match live forever.

One poll is not enough. Steam serves a partial feed while recovering from an
outage: on 2026-08-09 a single such payload ended three live matches, which
were re-discovered seventy seconds later. Nothing was corrupted — `startedAt`
survives on `$setOnInsert` and a duplicate prediction is blocked — but the
registry flapped and the console briefly showed live games as finished.

The cost of waiting is a `match ended` that arrives half a minute late. A
match that has really finished stays absent.

### Two logs exist to make silence meaningful

Production runs at `LOG_LEVEL=info`, and a healthy idle process used to log
nothing at all. That made "was it running at 13:10?" unanswerable — the only
evidence was whether snapshots had been written, and their absence has an
innocent explanation too. A manual restart then looks like it fixed something.

- **`discovery heartbeat`** — one `info` a minute carrying polls, failures,
  skips, live match count and seconds since the last successful poll. It runs
  outside the poll and outside the pause check, because a paused or wedged
  worker is exactly the state worth seeing. **A gap in this line is a gap in
  the process.**
- **`request`** — one line per HTTP request, logged on `finish`. `/health` goes
  to `debug` so Railway's probing does not bury the rest; raise `LOG_LEVEL` to
  see it. The query string is dropped, since that is where the Steam key would
  be.
