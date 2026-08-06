# Project Brief: Dota 2 Live Pro Match Analytics Backend

> Paste this into Claude Code as the initial task description. Adjust the
> **Assumptions to confirm** section first — I guessed at the stack.

---

## Context

I have an existing app that pulls live matches from OpenDota's `/live` endpoint.
The problem: that endpoint is **not** a pro-match feed. It returns "top currently
ongoing games" ranked by average MMR and spectator count. During The International
those slots happen to be filled by TI games, which made it look like a pro feed —
but during Majors, DreamLeague, ESL One, PGL, etc. it returns mostly high-MMR pubs
and the pro matches never appear.

I want to rebuild the data layer on sources that actually cover the full
professional circuit, and turn it into an analytics backend for a Dota 2 betting
analytics product.

## Goal

A service that:

1. Continuously discovers **every** live professional (ticketed league) Dota 2 match.
2. Polls each live match for detailed in-game state and persists immutable
   time-series snapshots.
3. Backfills completed matches with parsed post-game detail.
4. Maintains reference data: heroes, hero win rates by patch/bracket/position,
   teams, players, leagues, historical pro head-to-head records.
5. Exposes all of this through a clean internal API that a frontend and, later,
   a modeling layer can consume.

**This phase is data infrastructure only.** No odds modeling, no predictions, no
UI beyond a minimal debug view. Get the pipeline correct and the history clean
first — the snapshot archive is the training data for everything that comes later,
and it can't be recreated retroactively.

---

## Data sources

### 1. Valve Steam Web API — primary live source (free)

Auth: single Steam Web API key, env var `STEAM_API_KEY`. Server-side only, never
exposed to clients.

**Match discovery**

```
GET https://api.steampowered.com/IDOTA2Match_570/GetLiveLeagueGames/v1/
    ?key={STEAM_API_KEY}
    [&league_id={id}]
```

Returns all in-progress ticketed league matches. Key fields: `match_id`,
`server_steam_id`, `league_id`, `radiant_team`/`dire_team` (name, team_id, logo),
`radiant_score`, `dire_score`, `players[]`, `scoreboard` (per-player KDA, gold,
net worth, XP, items, plus tower/barracks bitmasks and draft picks/bans),
`spectators`, `series_type`, `radiant_series_wins`, `dire_series_wins`.

**Per-match detail**

```
GET https://api.steampowered.com/IDOTA2MatchStats_570/GetRealtimeStats/v1/
    ?key={STEAM_API_KEY}
    &server_steam_id={server_steam_id}
```

Richer snapshot: building state, per-player net worth/XP, draft state, graph data.
Valve refreshes this roughly every 6–9 seconds — no point polling faster.

**Reference**

```
GET https://api.steampowered.com/IEconDOTA2_570/GetHeroes/v1/?key=...&language=en
GET https://api.steampowered.com/IDOTA2Match_570/GetLeagueListing/v1/?key=...
GET https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/?key=...&match_id=...
```

**Known limitation to handle gracefully:** only matches with a real league ticket
and DotaTV enabled appear in `GetLiveLeagueGames`. Tier-3 events run in private
lobbies won't show up at all. Don't treat an empty list as an error.

### 2. STRATZ GraphQL — enrichment + live win probability (free tier)

Endpoint `https://api.stratz.com/graphql`, Bearer token from stratz.com/api in
`STRATZ_API_TOKEN`. Note: tokens expire after ~1 year — surface this as a
monitored condition, not a silent failure.

Use for: live match list with their own win-probability model (updates during
draft), hero win rates sliced by bracket/position/patch, league and team metadata,
parsed match history.

Check their terms of service before shipping anything gambling-adjacent — free
community APIs often restrict that explicitly. Flag it if you find a restriction.

### 3. OpenDota REST — historical and statistical (free tier, 60/min, 2000/day)

- `/proMatches` — recent professional matches
- `/leagues`, `/teams/{id}/matches`, `/players/{id}`
- `/heroStats` — pick/win counts per skill bracket
- `/matches/{id}` — full parsed detail (better than Valve's `GetMatchDetails`)
- `/explorer` — raw SQL against their Postgres; the fastest way to build
  head-to-head priors and pro-only hero win rates
- `/benchmarks`, `/scenarios`

Keep OpenDota for backfill and stats. Do **not** use it for live discovery.

---

## Architecture

Three independent workers plus an API layer. They should not share process state —
each recovers on its own.

**Discovery worker** — polls `GetLiveLeagueGames` every 20s. Upserts a
`live_matches` registry row per active match. Detects match start (new
`server_steam_id`) and match end (disappearance from the feed) and emits events.

**Snapshot worker** — for each active `server_steam_id`, polls `GetRealtimeStats`
every 8s. Writes an **append-only** row to `match_snapshots`. Never updates or
overwrites an existing snapshot. This table is the product.

**Backfill worker** — when a match ends, waits for parse availability then pulls
`/matches/{id}` from OpenDota and writes the final record, linking it to the
snapshot series by `match_id`.

**API layer** — read-only REST or GraphQL over the stored data.

## Data model (sketch — refine as you go)

- `leagues` — league_id, name, tier, region, prize pool, dates
- `teams` — team_id, name, tag, logo, region
- `players` — account_id, name, current team
- `heroes` — hero_id, name, localized name, attributes, roles
- `live_matches` — match_id (PK), server_steam_id, league_id, radiant/dire team ids,
  series_type, series wins, started_at, ended_at, status
- `match_snapshots` — (match_id, captured_at) composite PK, plus raw JSONB payload
  **and** extracted columns for the fields you'll query hot: game_time, radiant/dire
  net worth, kills, tower state, roshan state, draft state
- `completed_matches` — final parsed detail from OpenDota
- `hero_stats_daily` — patch, bracket, hero_id, picks, wins, captured_on

Store the raw API payload as JSONB alongside extracted columns. Valve changes
response shapes without notice and I'd rather re-extract from raw than lose data.

## Non-obvious requirements

- **Idempotency.** Restarting a worker mid-match must not corrupt or duplicate the
  snapshot series.
- **Backpressure.** During a Major there can be 8+ concurrent matches. Budget the
  Steam API call volume (~100k/day limit) and make the poll interval configurable
  per-worker.
- **Rate limit handling.** Exponential backoff on 429/5xx, with jitter. OpenDota's
  free tier is the tight one — respect 60/min.
- **Time base.** Persist both wall-clock (`captured_at`) and in-game clock
  (`game_time`). They diverge because of pauses, which are frequent in pro play and
  matter for any time-series modeling.
- **Series awareness.** Bo3/Bo5 series state matters more than individual games for
  betting context. Model the series as a first-class entity, not a field on a match.
- **Broadcast delay.** DotaTV runs ~2 minutes behind at big events, so this data is
  inherently delayed. Do not design anything that implicitly assumes real-time
  parity with a live betting market. Record the delay if it's measurable.

## Milestones

1. Repo scaffold, config, secrets handling, DB schema + migrations.
2. Discovery worker + `live_matches` registry. Verify against a live tournament.
3. Snapshot worker + `match_snapshots`. Verify snapshot density and no gaps.
4. Reference data sync (heroes, leagues, teams) on a daily schedule.
5. OpenDota backfill worker for completed matches.
6. Hero/team statistical aggregates from OpenDota.
7. Read API + a minimal debug page listing live matches and a net-worth graph.
8. Observability: per-worker health, last-successful-poll timestamps, alerting on
   stale data.

## Assumptions to confirm

Ask me about these before scaffolding rather than guessing:

- Language/runtime and framework
- Database (I'd default to Postgres for JSONB + time-series, but open to alternatives)
- Deployment target
- Whether this extends my existing OpenDota app or is a fresh service
- Whether a job scheduler/queue is warranted or plain interval loops suffice at
  this scale

## Explicit non-goals for this phase

- No odds ingestion or bookmaker integration
- No prediction model
- No user accounts, no frontend beyond the debug view
- No paid data providers (PandaScore, GRID, Abios) — free sources only for now
