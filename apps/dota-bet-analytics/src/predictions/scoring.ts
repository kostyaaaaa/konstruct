/**
 * The scoring, as a pure function.
 *
 * No network, no database — it takes the ten players' stats and returns two
 * scores. That makes it testable on its own, and it is what allowed the whole
 * model to be re-fitted offline against 81,846 historical matches.
 *
 * **The coefficients below were fitted, not chosen.** They come from a
 * logistic regression trained on tier 1–2 matches from 2023–24 and tested on
 * 24,868 matches from 2025 onward that it never saw: **60.5%** accuracy,
 * against 57.0% for the formula it replaced and 52.2% for always picking
 * Radiant. `research/19-fit-no-elo.mjs` reproduces these numbers.
 *
 * **Team strength is deliberately not a param.** A rating measures which team
 * is better, which is exactly what a bookmaker prices — a model built on it
 * agrees with the favourite and earns short odds. This model only looks at the
 * players and the heroes they picked, so when it disagrees with the market it
 * is because of something the market may not have weighed.
 *
 * Including a team rating measured 61.6%, so this costs about a point of raw
 * accuracy. That is the trade, made on purpose.
 *
 * Hero synergy — how a side's own five heroes work together — was fitted too
 * and made the model slightly worse. It is not here on purpose either.
 *
 * A coefficient is only valid alongside the params it was fitted with. Adding
 * or removing one means refitting all of them, not adjusting the new one.
 *
 * Two things the old formula got wrong, both now fixed:
 *
 * - **Familiarity rank did nothing.** `100 / heroRank` scored 51.2% against a
 *   52.2% baseline, and never improved as it grew more confident. It is gone.
 * - **A thin record counted as a strong one.** One win from one game read as
 *   100%. Shrinkage pulls it toward even until there is evidence.
 */

export interface PlayerHeroStats {
  accountId: number;
  heroId: number;
  /** Win rate on this hero, 0-100. Null when they have never played it. */
  winRate: number | null;
  /** Wins on this hero. Needed for shrinkage, which a percentage cannot give. */
  winsOnHero: number;
  gamesOnHero: number;
  /** True when the stats could not be fetched, rather than being genuinely absent. */
  missing: boolean;
}

export interface SideScore {
  /** Mean shrunk win rate across the five, 0-100. */
  heroWinRate: number;
  /** Mean games on the picked hero, on the log curve, 0-100ish. */
  heroGames: number;
  /** How these five heroes fare against the other five, 0-100. 50 is even. */
  heroMatchup: number;
}

/**
 * Identifies which model produced a prediction.
 *
 * Accuracy is measured across stored predictions, and margin means something
 * different here than under the old two-score formula. Without a version on
 * every row, the two would be averaged together and the answer would be
 * quietly wrong.
 */
export const MODEL_VERSION = 8;

/**
 * How hard a thin record is pulled toward even. A player with one win from one
 * game reads as 55%, not 100%; by twenty games their real rate dominates.
 */
const SHRINK = 10;

/**
 * How much each param is worth, per point.
 *
 * These are the fitted coefficients with the standardisation folded in. The fit
 * works on `(gap − mean) / sd`, which is only algebra:
 *
 *     c × (gap − mean) / sd  =  (c / sd) × gap  −  (c × mean / sd)
 *
 * The first half is a plain weight; the second is a constant that lands in
 * `RADIANT_BONUS`. Flattening them changes nothing — verified against all
 * 24,868 held-out matches, where both forms pick the same side every time.
 *
 * The three are scaled to sum to 1, which is only cosmetic: dividing every
 * weight *and* the bonus by the same number shrinks both sides' scores equally,
 * so the favoured side and the margin are untouched. It makes a score read
 * near 50, like a percentage.
 *
 * They are not proportions, despite summing to 1. Each converts a different
 * unit into score points — `heroGames` reaches 342 while `heroMatchup` sits
 * near 50, so they cannot share a weight.
 */
const WEIGHTS = {
  heroWinRate: 0.4977,
  heroMatchup: 0.3998,
  heroGames: 0.1026,
} as const;

/** Radiant wins ~54% of professional matches. This is that edge, in points. */
const RADIANT_BONUS = 0.6781;

/**
 * Games on a hero count on a **log curve**, not a straight line.
 *
 * Counted straight, 1000 games would be worth twice 500 — which is not how
 * comfort works. The gap between 10 games and 100 is real; the gap between 500
 * and 1000 is barely anything. On this curve 10 games scores 41, 100 scores 79,
 * 500 scores 106 and 1000 scores 118.
 *
 * It is worth a full point of accuracy: 60.6% against 59.4% counting straight.
 *
 * The multiplier puts the result on the same 0-100 scale as the other two
 * params, so the weights can be read against each other.
 */
const GAMES_SCALE = 17.1299;

function gamesScore(games: number): number {
  return Math.log(1 + games) * GAMES_SCALE;
}

/** Shrunk win rate for one player on the hero they are about to play. */
function shrunkWinRate(player: PlayerHeroStats): number {
  return ((player.winsOnHero + SHRINK * 0.5) / (player.gamesOnHero + SHRINK)) * 100;
}

export function scoreSide(players: readonly PlayerHeroStats[], heroMatchup = 50): SideScore {
  if (players.length === 0) {
    return { heroWinRate: 50, heroGames: 0, heroMatchup };
  }

  const heroWinRate = players.reduce((total, p) => total + shrunkWinRate(p), 0) / players.length;
  const heroGames =
    players.reduce((total, p) => total + gamesScore(p.gamesOnHero), 0) / players.length;

  return {
    heroWinRate: Number(heroWinRate.toFixed(2)),
    heroGames: Number(heroGames.toFixed(2)),
    heroMatchup,
  };
}

/** One number for a side. Higher is better; the two are only comparable to each other. */
export function totalScore(side: SideScore, isRadiant: boolean): number {
  const total =
    WEIGHTS.heroWinRate * side.heroWinRate +
    WEIGHTS.heroMatchup * side.heroMatchup +
    WEIGHTS.heroGames * side.heroGames +
    (isRadiant ? RADIANT_BONUS : 0);

  return Number(total.toFixed(2));
}

/** Which side the numbers favour, and by how much. */
export function pick(radiant: SideScore, dire: SideScore) {
  const radiantScore = totalScore(radiant, true);
  const direScore = totalScore(dire, false);
  const margin = Math.abs(radiantScore - direScore);
  const larger = Math.max(radiantScore, direScore);

  return {
    favoured: radiantScore === direScore ? null : radiantScore > direScore ? 'radiant' : 'dire',
    radiantScore,
    direScore,
    margin: Number(margin.toFixed(2)),
    /* The gap as a share of the bigger score, so the same threshold means the
       same thing across matches. */
    marginPercent: larger > 0 ? Number(((margin / larger) * 100).toFixed(2)) : 0,
  };
}
