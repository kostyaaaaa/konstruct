/**
 * Is the Elo-implied probability honest?
 *
 * Every param in step 8 showed a positive edge when picking underdogs —
 * including ones with no demonstrated signal. That is the signature of a
 * biased baseline rather than fifteen good params: if Elo systematically
 * underrates underdogs, then *anything* that picks underdogs looks clever.
 *
 * This bins matches by what Elo predicted and compares that to what happened.
 * A calibrated model sits on the diagonal.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const scored = rows.filter(
  (r) =>
    r.start_time >= rows[0].start_time + 182 * 24 * 3600 &&
    r.radiant.teamGames > 20 &&
    r.dire.teamGames > 20,
);

const bins = new Map();
for (const row of scored) {
  const p = 1 / (1 + 10 ** ((row.dire.teamElo - row.radiant.teamElo) / 400));
  const bin = Math.min(0.95, Math.max(0.05, Math.round(p * 20) / 20));
  const b = bins.get(bin) ?? { n: 0, wins: 0 };
  b.n += 1;
  b.wins += row.radiant_win ? 1 : 0;
  bins.set(bin, b);
}

console.log('  Elo said Radiant wins    actually won      n      gap');
console.log('  ' + '-'.repeat(58));
let weighted = 0;
let total = 0;
for (const [bin, b] of [...bins].sort((a, b) => a[0] - b[0])) {
  if (b.n < 200) {
    continue;
  }
  const actual = (100 * b.wins) / b.n;
  const gap = actual - bin * 100;
  weighted += gap * b.n;
  total += b.n;
  console.log(
    `  ${(bin * 100).toFixed(0).padStart(14)}%  ${actual.toFixed(1).padStart(18)}%  ${String(b.n).padStart(7)}  ${(gap >= 0 ? '+' : '') + gap.toFixed(1)}`.padEnd(
      60,
    ),
  );
}
console.log(`\n  average gap, weighted by sample: ${(weighted / total).toFixed(2)} points`);
console.log('  (a calibrated model sits near zero at every row)');
