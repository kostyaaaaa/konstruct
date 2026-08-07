# Research workbench

Offline experiments for the prediction model. **Nothing here runs in the app.**
It sits outside `src/`, so it is never compiled into `dist` or deployed.

The point is to answer one question honestly: which params actually predict the
winner of a professional Dota match, and how confident can we be.

## Vocabulary

- **param** — one measurable quantity about one side of one match, computed
  only from what was known **before** that match started.
- **strategy** — a named idea about what wins matches, expressed as a
  coefficient per param. Score for a side is `Σ (coefficient × param)`; the
  higher score is the pick, and the gap between the two sides is the margin.

## Pipeline

| Script                 | Does                                                      |
| ---------------------- | --------------------------------------------------------- |
| `01-fetch-matches.mjs` | Every tier 1–2 match since 2023 → `data/matches.jsonl`    |
| `02-fetch-players.mjs` | The ten players of each → `data/player-matches.jsonl`     |
| `03-build-params.mjs`  | Walks time forward, computes params → `data/params.jsonl` |
| `04-evaluate.mjs`      | Scores every strategy, overall and by margin              |
| `05-holdout.mjs`       | The same, split by period, to catch a meta-only edge      |

Data is gitignored — it is large and every file is reproducible from step 1.
Steps 1 and 2 take about an hour; 3 to 5 take seconds, which is the point of
splitting them.

## The one rule: no future information

Every param is computed from matches **before** the one being predicted, then
that match is added to the history. A player's win rate on a hero is what it
was that morning, not what it is today.

This is not a detail. Using today's `/players/{id}/heroes` on a 2023 match
would include the result of that very match and every game since — the model
would look excellent and be reading the answer off the back of the paper.

Two consequences worth remembering when reading any number here:

- **Pro matches only.** These win rates come from tier 1–2 matches since 2023,
  not from a player's whole career including pubs. Production uses OpenDota's
  career figure, so the backtest measures a _related_ param, not the identical
  one.
- **The window has an edge.** Everyone starts 2023 with an empty record, so the
  first six months are excluded from scoring.

## Params

Player params are **averaged over the five players** of a side, so a win rate
reads 0-100 like an ordinary percentage. A sum and a mean of five carry the
same information, and the mean does not need translating every time it is read.

Counts (`heroGames`, `playerGames`) are per player too — `heroGames = 14` means
the five average fourteen games each on the heroes they picked.

### From a player's history on the hero they are playing

| Param               | Formula                                        | Source                 |
| ------------------- | ---------------------------------------------- | ---------------------- |
| `heroWinRate`       | `Σ (wins / games) × 100`                       | derived, point-in-time |
| `heroWinRateShrunk` | `Σ (wins + 5) / (games + 10) × 100`            | derived, point-in-time |
| `heroGames`         | `Σ games on that hero`                         | derived, point-in-time |
| `heroRankScore`     | `Σ 100 / rank`                                 | derived, point-in-time |
| `heroGamesRecent`   | `Σ games on that hero in the last 90 days`     | derived, point-in-time |
| `heroWinRateRecent` | `Σ shrunk win rate on that hero, last 90 days` | derived, point-in-time |

- **`heroWinRate`** is the production param. A player with no games on the hero
  contributes 0, which is why `known` exists alongside it.
- **`heroWinRateShrunk`** pulls a thin record toward 50%: 1 win from 1 game
  reads as 55%, not 100%. `SHRINK = 10` is the strength of that pull and is a
  guess worth testing.
- **`heroRankScore`** is production's familiarity term. `rank` is the hero's
  position in that player's most-played list, so their most-played hero scores
  100, the second 50, the third 33. The curve is steep and arbitrary.
- **`heroGamesRecent` / `heroWinRateRecent`** are the same comfort idea with a
  90-day window. An all-time count treats a hero last played two years ago as
  current, which is the opposite of what comfort means.

### From a player's whole record

| Param           | Formula                                           |
| --------------- | ------------------------------------------------- |
| `playerGames`   | `Σ total pro games so far`                        |
| `playerWinRate` | `Σ (wins / games) × 100`, 50 when unknown         |
| `known`         | how many of the five had played their hero before |

### From the team

| Param            | Formula                                             |
| ---------------- | --------------------------------------------------- |
| `teamElo`        | Elo, start 1500, K=24, updated after every match    |
| `teamGames`      | matches played so far                               |
| `teamWinRate`    | `(wins / games) × 100`, 50 when unknown             |
| `teamFormRecent` | win rate over the last 20 matches, shrunk toward 50 |
| `teamFormGames`  | how many of those 20 exist yet                      |

**Elo is a rating, not a rank.** Bigger is better, and there is no number one —
it is a running score, not a position in a list. Every team starts at 1500.

After a match the winner takes points from the loser, and the size of the
transfer depends on who was expected to win:

```
expected = 1 / (1 + 10^((opponentRating − ownRating) / 400))
rating  += K × (actual − expected)          // actual is 1 for a win, 0 for a loss
```

Beating a much stronger team is worth many points; beating a much weaker one is
worth almost none, and losing to them is expensive. A 400-point lead means the
stronger side is expected to win about 91% of the time; 100 points means 64%.

`K = 24` caps how much one match can move a rating. Higher reacts faster to a
roster change, lower is steadier against a bad week. It is a guess worth testing.

`teamFormRecent` exists because Elo is deliberately slow. A fixed window of 20
matches notices a slump or a new roster immediately, where Elo takes weeks.

### From the draft

| Param         | Formula                                                         |
| ------------- | --------------------------------------------------------------- |
| `heroMatchup` | `Σ over our 5 heroes of the mean win rate against the enemy 5`  |
| `heroSynergy` | `Σ over our 10 hero pairs of their win rate together`           |
| `heroMeta`    | `Σ over our 5 heroes of that hero's pro win rate, last 90 days` |

Both read a matrix built forward in time from every match in the dataset: for
`heroMatchup`, how often hero A's side beat a side containing hero B; for
`heroSynergy`, how often two heroes on the same side won together. Each cell is
shrunk toward 50% by its own sample size, because most hero pairs are rare.

`heroMeta` is about the hero, not the player. Without it, `heroWinRate` mixes
"this player is good on Storm Spirit" with "Storm Spirit is strong this patch",
and the two move independently.

These are the only params about the **draft** rather than the people, and the
ones a bookmaker's team-strength model is least likely to price well.

## A note before setting coefficients

Params are on wildly different scales _and_ have wildly different spreads.
`teamElo` ranges 1179–2088; `heroSynergy` only 42.5–59.2. A coefficient of 1 on
each does not weight them equally — it weights `teamElo` about fifty times
harder.

Any serious comparison should standardise each param first, or the coefficients
are measuring the units rather than the idea.

#### From the ladder — recent matches only

| Param         | Formula                                                |
| ------------- | ------------------------------------------------------ |
| `ladderScore` | `mean over 5 of (5000 − leaderboardRank) / 5000 × 100` |
| `ladderCount` | how many of the five appear on the leaderboard at all  |

**These two cannot be used before the last 90 days.** OpenDota keeps no history
of ladder rank — the value fetched is today's — so applied to an older match it
is future information. `06-fetch-profiles.mjs` fetches them and
`07-evaluate-rank.mjs` scores them on that window alone.

Production has no such problem: at prediction time the current rank _is_ the
point-in-time value. It is already stored on every prediction, so an honest
history is accumulating on its own.

## Constant

| Param  | Value                                                     |
| ------ | --------------------------------------------------------- |
| `side` | 1 for Radiant, 0 for Dire. Radiant wins ~54% of the time. |
