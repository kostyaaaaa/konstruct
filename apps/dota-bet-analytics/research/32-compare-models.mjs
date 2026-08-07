/**
 * The model in production today against the one replacing it.
 *
 * Old:  0.8 x (sum of raw hero win rates) + 0.2 x (sum of 100/heroRank)
 * New:  0.4977 x heroWinRate(shrunk) + 0.3998 x heroMatchup
 *       + 0.1026 x log-games + 0.68 for Radiant
 *
 * The old model summed over five players where the new one averages, but that
 * is a uniform scale on both sides — it changes neither the pick nor the
 * margin, so the two are directly comparable.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const GAMES_SCALE = 17.1299;
const oldScore = (s) => 0.8 * s.heroWinRate + 0.2 * s.heroRankScore;
const newScore = (s, isRadiant) =>
  0.4977 * s.heroWinRateShrunk +
  0.3998 * s.heroMatchup +
  0.1026 * Math.log(1 + s.heroGames) * GAMES_SCALE +
  (isRadiant ? 0.6781 : 0);

function measure(list, score) {
  const out = {};
  for (const threshold of [0, 5, 10, 15, 20]) {
    let n = 0;
    let right = 0;
    for (const r of list) {
      const a = score(r.radiant, true);
      const b = score(r.dire, false);
      if (a === b) {
        continue;
      }
      const margin = (Math.abs(a - b) / Math.max(a, b)) * 100;
      if (margin < threshold) {
        continue;
      }
      n += 1;
      right += a > b === r.radiant_win ? 1 : 0;
    }
    out[threshold] = { n, pct: n ? (100 * right) / n : 0 };
  }
  return out;
}

function table(label, list) {
  const o = measure(list, oldScore);
  const w = measure(list, newScore);
  console.log(`\n  ${label} — ${list.length.toLocaleString()} matches`);
  console.log('  margin |        OLD (in prod)  |        NEW           | change');
  console.log('         |  matches   win rate   |  matches   win rate  |');
  console.log('  ' + '-'.repeat(66));
  for (const t of [0, 5, 10, 15, 20]) {
    const a = o[t];
    const b = w[t];
    const d = b.pct - a.pct;
    console.log(
      `  >${String(t).padEnd(4)}  | ${String(a.n).padStart(8)}    ${a.pct.toFixed(2)}%   | ${String(b.n).padStart(8)}    ${b.pct.toFixed(2)}%  | ${(d >= 0 ? '+' : '') + d.toFixed(2)}`,
    );
  }
}

const warm = rows[0].start_time + 182 * 24 * 3600;
table(
  'EVERYTHING after warm-up',
  rows.filter((r) => r.start_time >= warm),
);
table(
  'HELD OUT — 2025 onward',
  rows.filter((r) => r.start_time >= Date.parse('2025-01-01') / 1000),
);
