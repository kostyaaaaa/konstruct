# dota-bet-analytics — todo

Planned work, roughly in priority order. What the app does today is in
[dota-bet-analytics.md](dota-bet-analytics.md).

## 1. Check the scoring still makes sense

The formula was written a long time ago and has never been reviewed against
results:

```
score = (sum of the five hero win rates) × 0.8
      + (sum of 100 ÷ hero familiarity rank) × 0.2
```

Things to question:

- **Win rate has no time window.** It is the player's whole recorded history on
  that hero, so games from several patches ago count the same as last week's.
  A hero reworked since then makes the number meaningless.
- **Nothing knows about the patch or the meta.** A hero that is strong right now
  scores the same as one that is not.
- **Nothing knows about the draft.** Counters, lane matchups and team
  composition are all ignored; the ten heroes are scored as ten separate
  players.
- **The 80/20 split is a guess.** So is `100 ÷ rank` as the shape of the
  familiarity curve.
- **Roles are ignored.** A support on their best hero counts as much as a carry
  on theirs.

The accuracy screen already measures this — accuracy at a confidence threshold,
over settled predictions. Enough settled matches make it possible to test a
change rather than argue about it. Keep `scoring.ts` a pure function so a new
formula can be run over stored predictions offline.

## 2. Decide which data should come from Valve rather than OpenDota

OpenDota is not Valve. It has its own database built from matches it has
fetched and parsed, so a value can be missing, stale, or computed differently
from what Valve reports.

Today the split is:

| Source                | Used for                                               |
| --------------------- | ------------------------------------------------------ |
| Steam Web API (Valve) | Live games, the scoreboard, series state               |
| OpenDota              | League tiers, player profiles, per-hero stats, results |

Worth checking:

- **Player hero win rates and familiarity ranks** — the whole prediction rests
  on these, and they are the values most likely to be incomplete, since OpenDota
  only knows the matches it has ingested.
- **Match results** used by the backfill worker.
- **Leaderboard ranks**, which change constantly.

**Verify against Dotabuff**, which is the trusted reference here. Take a handful
of pro players, compare their hero win rates and game counts across OpenDota and
Dotabuff, and record what differs.

Note the real constraint before planning a move: Valve's API returns **raw
matches**, not aggregates. There is no Valve endpoint for "this player's win
rate on this hero" — getting it from Valve means fetching match history and
computing it, which is a lot more calls and a store of our own. That may still
be right, but it is a bigger change than swapping a URL.

## 3. Decide what to do about the broadcast delay

**The feed is delayed, and so is the data — not just the video.** Each game
carries a `stream_delay_s`, and the scoreboard we read appears to be on that
same delayed timeline. A league running a 15-minute delay gives us a match that
reports `duration: 0` and ten `hero_id: 0` for its first 15 minutes.

Measured on 6 August 2026, across the 47 games in the feed at that moment:

| `stream_delay_s` | started | not started |
| ---------------- | ------- | ----------- |
| 10               | 22      | 4           |
| 120              | 7       | 3           |
| 300              | 2       | 3           |
| 900              | 1       | 5           |

At a 10-second delay almost every game has started; at 900 seconds almost none
have. A tracked match sat in the registry for seven minutes with 42 snapshots,
all of them `gameTime 0` and `netWorth 0`.

Note the mechanism is **inferred from the behaviour, not documented**. No Valve
statement was found saying `GetLiveLeagueGames` serves the scoreboard on the
delayed timeline; the correlation above is the evidence.

**The consequence.** A prediction cannot be made before the draft is visible, so
in a 15-minute-delay league it lands roughly 15 minutes into the real game.
Still before the match ends, but not at draft time. Nothing is broken — the
poll retries and scores it as soon as the heroes appear.

No decision made. The options:

- **Accept it**, and make the staleness visible — show the delay next to the
  prediction so the reader knows how old the pick already is when it arrives.
- **Weight by delay**, treating a low-delay league's prediction as worth more
  than a high-delay one's.
- **Find the draft elsewhere.** ~~OpenDota~~ — checked and ruled out, below.

### OpenDota cannot supply the draft any earlier

Measured 6 August 2026, against live matches on a 900-second delay:

| Check                              | Result                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `/matches/<id>` for a live match   | `{"error":"Not Found"}` — finished matches only                              |
| `/live` pro coverage               | 1 game with a `league_id`, against 49 in Steam's feed                        |
| `delay` on that one game           | `900` — the same number Valve reports                                        |
| Its `game_time` over three fetches | `1818`, `1818`, `1818` — frozen, and the match had already left Steam's feed |

So OpenDota is not an earlier source. It is behind, far less complete, and
reports the same delay.

**This is structural.** OpenDota reads live data from the same Valve game
coordinator, and the delay is applied by Valve at the source, so any third
party reading Valve's data inherits it. Only a client inside the lobby — a
broadcaster or observer — sees the game undelayed.

Stratz is the remaining candidate and is **untested**. Expect the same
constraint for the same reason before spending time on it.

One trap if this is revisited: OpenDota's `/live` returns `match_id` as a
**string**, while Steam returns a number. Comparing them directly matches
nothing and looks like empty coverage.

## 4. Learn NestJS properly, using this app

Written by Claude, so the framework was never actually learned. Worth
understanding rather than pattern-matching, since every future change goes
through it.

Start with [../rules/nestjs.md](../rules/nestjs.md), then read this app's own
code for each idea:

- **Decorators** — what `@Injectable`, `@Module`, `@Controller` and `@Interval`
  actually do, and that they are ordinary functions that attach metadata.
- **Dependency injection** — how a constructor parameter's _type_ is enough for
  Nest to supply it, and why that needs `emitDecoratorMetadata`. This is not
  academic: it is exactly why `@konstruct/eslint-config/nest` has to switch
  `consistent-type-imports` off, and why the app once failed to boot with
  `UnknownDependenciesException` while compiling perfectly.
- **Modules** — what `imports`, `providers` and `exports` mean, and why a
  circular dependency between two modules is a design smell rather than a case
  for `forwardRef`.
- **Lifecycle hooks** — `OnModuleInit`, and graceful shutdown.

The clearest examples in this app: `DiscoveryService` for scheduling and
injection, `CommonModule` for exporting a shared provider, `ReportService` for
`OnModuleInit`.
