/**
 * The shipping model, run over every match in the dataset.
 *
 * Uses the exact weights in `scoring.ts`, so this is what production would have
 * predicted. Reported twice: over everything, and over 2025 onward only —
 * matches the weights were never fitted on. The second is the honest number.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const WEIGHTS = { heroWinRate: 0.4977, heroMatchup: 0.3998, heroGames: 0.1026 };
const RADIANT_BONUS = 0.6781;
const GAMES_SCALE = 17.1299;

const score = (s, isRadiant) =>
  WEIGHTS.heroWinRate * s.heroWinRateShrunk +
  WEIGHTS.heroMatchup * s.heroMatchup +
  WEIGHTS.heroGames * Math.log(1 + s.heroGames) * GAMES_SCALE +
  (isRadiant ? RADIANT_BONUS : 0);

function report(label, list) {
  console.log(`\n  ${label} — ${list.length.toLocaleString()} matches`);
  console.log('    margin    matches   correct   win rate     ±95%');
  for (const threshold of [0, 5, 10, 15]) {
    let n = 0;
    let right = 0;
    for (const r of list) {
      const a = score(r.radiant, true);
      const b = score(r.dire, false);
      const margin = (Math.abs(a - b) / Math.max(a, b)) * 100;
      if (margin < threshold) {
        continue;
      }
      n += 1;
      right += a > b === r.radiant_win ? 1 : 0;
    }
    const pct = n ? (100 * right) / n : 0;
    const ci = n ? 1.96 * Math.sqrt(0.25 / n) * 100 : 0;
    console.log(
      `    >${String(threshold).padEnd(3)}%  ${String(n).padStart(9)} ${String(right).padStart(9)}   ${pct.toFixed(2)}%     ±${ci.toFixed(2)}`,
    );
  }
}

const warm = rows[0].start_time + 182 * 24 * 3600;
report(
  'EVERYTHING after warm-up',
  rows.filter((r) => r.start_time >= warm),
);
report(
  'HELD OUT — 2025 onward, never trained on',
  rows.filter((r) => r.start_time >= Date.parse('2025-01-01') / 1000),
);
