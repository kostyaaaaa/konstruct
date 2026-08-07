# dota-bet-analytics — todo

Planned work, roughly in priority order. What the app does today is in
[dota-bet-analytics.md](dota-bet-analytics.md).

## 1. Rebuild the score on what the data says

The scoring was reviewed against 81,846 tier 1–2 matches from 2023 onward. The
work is in [`research/`](../../apps/dota-bet-analytics/research/README.md) and
is reproducible; this records what it found and what production should become.

### What was measured

Every number below is walk-forward: params come only from matches _before_ the
one being predicted. The model was trained on 2023–24 and tested on 13,107
matches from 2025 onward that it never saw.

| Strategy                                | Held-out accuracy |
| --------------------------------------- | ----------------- |
| Always pick Radiant (the real baseline) | 52.2%             |
| **Production today**                    | **57.0%**         |
| Team strength (Elo) alone               | 60.0%             |
| Everything fitted together              | **61.9%**         |

### What works, and what does not

- **`heroRankScore` is dead.** Production's 0.2 familiarity term — `100/rank` —
  scores 51.2% alone, does not improve as it grows more confident, and shows a
  +0.8 point edge against a fair price. It failed every test it was given.
  Familiarity as an _idea_ survives, but only as a hero win rate.
- **A thin record must be shrunk.** `(wins + 5) / (games + 10)` beats the raw
  win rate everywhere. Production currently lets one win from one game count as
  100%.
- **Team strength is left out on purpose.** It was the strongest param
  measured, and it is also exactly what a bookmaker prices — a model built on it
  agrees with the favourite and earns short odds. The point of this model is to
  disagree for reasons the market may not have weighed, so it looks only at the
  players and the draft. The cost is about two points of accuracy.
- **The draft matters, and is ours to exploit.** Hero matchup — how our five
  heroes have historically fared against theirs — carries almost the same
  weight as hero win rate once fitted, and it is the param a bookmaker's
  team-strength model is least likely to price.
- **Recent team form is a trap**: −1.4 points against a fair price.

### Every fit that was run, and which one ships

**A coefficient is only meaningful next to the params it was fitted with.**
Remove one and the others are refitted from scratch — nothing is redistributed.
That is why `teamElo` is 0.272 in one row below and 0.363 in another: where
`playerWinRate` is present it absorbs part of the same signal, because strong
teams are made of players who win a lot.

Accuracy is on the same held-out matches from 2025 in every row.

| Script                        | Params           | `teamElo` | Accuracy  |
| ----------------------------- | ---------------- | --------- | --------- |
| `12-fit-production.mjs`       | 2                | absent    | 58.2%     |
| `13-fit-with-elo.mjs`         | 3                | 0.341     | 60.9%     |
| **`14-fit-with-matchup.mjs`** | **4**            | **0.345** | **61.6%** |
| `16-draft-only.mjs`           | 3 draft          | absent    | 55.5%     |
| `18-all-params.mjs` (A)       | 14               | 0.363     | 62.3%     |
| `18-all-params.mjs` (B)       | 13               | absent    | 61.1%     |
| `18-all-params.mjs` (C)       | 10, no team info | absent    | 60.8%     |

**`19-fit-no-elo.mjs` is what production runs.** Three params — the three the
app can compute at prediction time without team strength. The rows that use a
team rating are kept for comparison only; that route was measured and then
deliberately not taken.

`11-fit.mjs` was the first exploratory fit — nine params, and a subset filtered
to teams with 20+ matches. Its numbers are not comparable with the rows above
and it is kept only as the record of which params were worth pursuing.

### Two traps worth not falling into twice

**Never score against an uncalibrated price.** Raw Elo is over-confident — it
says 20% and underdogs win 27%. Measured against it, all fifteen params showed
a healthy edge, which is not a discovery but a warning. Refitting the divisor
from 400 to 540 halved every one of them. When every candidate looks good,
suspect the yardstick.

**Never use today's numbers on yesterday's match.** A player's win rate from
`/players/{id}/heroes` includes the match being predicted and everything since.
The whole research pipeline exists to avoid this.

### Is it profitable? Unknown, and unknowable so far

Backing only where the fitted model disagrees with the price by more than 5
points gives **52.9% on 5,176 held-out bets against a 44.0% fair price** — an
edge of +8.9. That would clear a normal bookmaker margin.

But the "fair price" is our own Elo, not a bookmaker's, and a bookmaker prices
with rosters, stand-ins and money flow on top of a rating. Beating our Elo is
necessary for an edge and nowhere near sufficient. **Historical closing odds
are the missing piece**, and until they exist the honest claim is only that the
model knows things team strength does not.

### What production should become

Staged, because the later stages need stores that do not exist yet.

1. ~~Drop `heroRankScore`, shrink the win rate, output a probability.~~ **Done**
   — model v2, 58.2% held out.
2. ~~Team ratings.~~ **Built, then removed.** It worked — 60.9% — but a rating
   is what a bookmaker already prices, so the model spent its accuracy agreeing
   with the favourite. Removed on purpose; the store is gone with it.
3. ~~Hero matchup matrix.~~ **Done** — fitted weight 0.160, the second
   strongest param in the model. Hero synergy was fitted alongside it and made
   things worse, so it was left out.

All three stages are built. What remains is not more params but **real odds**:
without them "the model knows things team strength does not" cannot become "the
model makes money".

A prediction must record which model produced it. Margin means something
different under a probability model, and mixing the two silently corrupts the
accuracy endpoint.

## 2. Learn NestJS properly, using this app

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
