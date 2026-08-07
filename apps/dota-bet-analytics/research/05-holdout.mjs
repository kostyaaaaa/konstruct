/**
 * Same strategies, split by period.
 *
 * The coefficients were chosen by hand rather than fitted, so there is nothing
 * to overfit — but the *choice* of which strategy to believe was made after
 * seeing the results, and the meta changes between years. If an edge only
 * exists in 2023 it is history, not a strategy.
 */
import { readFileSync } from 'node:fs';

import { scoreSide, strategies } from './strategies.mjs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const cutoff = rows[0].start_time + 182 * 24 * 3600;
const periods = [
  ['warm-up→2024', (r) => r.start_time >= cutoff && r.start_time < Date.parse('2025-01-01') / 1000],
  ['2025 onward', (r) => r.start_time >= Date.parse('2025-01-01') / 1000],
  ['2026 only', (r) => r.start_time >= Date.parse('2026-01-01') / 1000],
];

function run(subset, strategy, threshold) {
  let right = 0;
  let total = 0;
  for (const row of subset) {
    const r = scoreSide(row.radiant, strategy.params, true);
    const d = scoreSide(row.dire, strategy.params, false);
    if (r === d) {
      continue;
    }
    const larger = Math.max(Math.abs(r), Math.abs(d));
    const margin = larger > 0 ? (Math.abs(r - d) / larger) * 100 : 0;
    if (margin < threshold) {
      continue;
    }
    total += 1;
    right += r > d === row.radiant_win ? 1 : 0;
  }
  return {
    total,
    pct: total ? (100 * right) / total : 0,
    ci: total ? 1.96 * Math.sqrt(0.25 / total) * 100 : 0,
  };
}

for (const threshold of [0, 10]) {
  console.log(`\n=== margin ≥ ${threshold}% ===`);
  console.log('strategy'.padEnd(22) + periods.map(([n]) => n.padStart(22)).join(''));
  for (const s of strategies) {
    const cells = periods
      .map(([, filter]) => {
        const { total, pct, ci } = run(rows.filter(filter), s, threshold);
        return total < 50
          ? 'n/a'.padStart(22)
          : `${pct.toFixed(1)}% ±${ci.toFixed(1)} (${total})`.padStart(22);
      })
      .join('');
    console.log(s.name.padEnd(22) + cells);
  }
}
