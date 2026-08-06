/**
 * The scoring, as a pure function.
 *
 * No network, no database — it takes the ten players' stats and returns the
 * two numbers. That makes it testable on its own, and it is the one piece of
 * the old app worth preserving exactly.
 *
 * Per side:  score = (sum of hero win rates) * 0.8 + (sum of 100 / heroRank) * 0.2
 *
 * `heroRank` is where the hero sits in that player's most-played list, so a
 * player on their best hero contributes 100 and their tenth-best contributes
 * 10 — familiarity, weighted a fifth as heavily as win rate.
 */

export interface PlayerHeroStats {
  accountId: number;
  heroId: number;
  /** Win rate on this hero, 0-100. Null when they have never played it. */
  winRate: number | null;
  /** 1-based rank in their most-played list. Null when never played. */
  heroRank: number | null;
  gamesOnHero: number;
  /** True when the stats could not be fetched, rather than being genuinely absent. */
  missing: boolean;
}

export interface SideScore {
  score: number;
  winRateComponent: number;
  familiarityComponent: number;
}

const WIN_RATE_WEIGHT = 0.8;
const FAMILIARITY_WEIGHT = 0.2;

export function scoreSide(players: readonly PlayerHeroStats[]): SideScore {
  const winRateComponent = players.reduce((total, player) => total + (player.winRate ?? 0), 0);

  const familiarityComponent = players.reduce((total, player) => {
    /* A hero the player has never picked contributes nothing. The old code
       divided by a rank of 0 here and produced Infinity, which then made the
       whole side's score NaN. */
    if (!player.heroRank || player.heroRank <= 0) return total;
    return total + 100 / player.heroRank;
  }, 0);

  const score = winRateComponent * WIN_RATE_WEIGHT + familiarityComponent * FAMILIARITY_WEIGHT;

  return {
    score: Number(score.toFixed(2)),
    winRateComponent: Number(winRateComponent.toFixed(2)),
    familiarityComponent: Number(familiarityComponent.toFixed(2)),
  };
}

/** Which side the numbers favour, and by how much. */
export function pick(radiant: number, dire: number) {
  const margin = Math.abs(radiant - dire);
  const favoured = radiant === dire ? null : radiant > dire ? 'radiant' : 'dire';
  const larger = Math.max(radiant, dire);

  return {
    favoured,
    margin: Number(margin.toFixed(2)),
    /** Margin as a share of the bigger score — comparable across matches. */
    marginPercent: larger > 0 ? Number(((margin / larger) * 100).toFixed(2)) : 0,
  };
}
