import Handlebars from 'handlebars';

/**
 * Banding helpers used by the report template to colour each cell.
 *
 * Each family answers "how good is this number", and the template picks a
 * style from the first one that returns true. Thresholds are carried over from
 * the original report unchanged — they are the author's judgement, not
 * something to re-derive.
 */
const BANDS = {
  Rank: [
    ['isAwesomeRank', (v: number) => v <= 10],
    ['isGoodRank', (v: number) => v > 10 && v <= 100],
    ['isNormalRank', (v: number) => v > 100 && v <= 300],
    ['isBadRank', (v: number) => v > 300 && v <= 1000],
    ['isAwfulRank', (v: number) => v > 1000],
  ],
  Popular: [
    ['isAwesomePopular', (v: number) => v <= 10],
    ['isGoodPopular', (v: number) => v > 10 && v <= 20],
    ['isNormalPopular', (v: number) => v > 20 && v <= 50],
    ['isBadPopular', (v: number) => v > 50 && v <= 90],
    ['isAwfulPopular', (v: number) => v > 90],
  ],
  TotalGames: [
    ['isAwesomeTotalGames', (v: number) => v >= 500],
    ['isGoodTotalGames', (v: number) => v < 500 && v >= 200],
    ['isNormalTotalGames', (v: number) => v < 200 && v >= 100],
    ['isBadTotalGames', (v: number) => v < 100 && v >= 35],
    ['isAwfulTotalGames', (v: number) => v < 35],
  ],
  Winrate: [
    ['isAwesomeWinrate', (v: number) => v >= 65],
    ['isGoodWinrate', (v: number) => v < 65 && v >= 55],
    ['isNormalWinrate', (v: number) => v < 55 && v >= 50],
    ['isBadWinrate', (v: number) => v < 50 && v >= 40],
    ['isAwfulWinrate', (v: number) => v < 40],
  ],
} as const satisfies Record<string, readonly (readonly [string, (value: number) => boolean])[]>;

let registered = false;

/** Idempotent — Handlebars keeps helpers globally, so this runs once. */
export function registerReportHelpers(): void {
  if (registered) {
    return;
  }

  for (const family of Object.values(BANDS)) {
    for (const [name, test] of family) {
      Handlebars.registerHelper(name, (value: unknown) =>
        typeof value === 'number' ? test(value) : false,
      );
    }
  }

  registered = true;
}
