/**
 * Where the constants come from, and what removing a param actually does.
 *
 * Two things this shows:
 *
 * 1. The "magic numbers" are measured, not chosen. Each is the average and the
 *    typical size of that param's gap across the training matches.
 * 2. Removing a param does not redistribute its coefficient. The model is
 *    refitted from scratch, and the remaining coefficients change by whatever
 *    the data says — usually growing, because they now have to carry
 *    information the removed param was carrying.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const usable = rows.filter((r) => r.start_time >= rows[0].start_time + 182 * 24 * 3600);
const SPLIT = Date.parse('2025-01-01') / 1000;
const train = usable.filter((r) => r.start_time < SPLIT);
const test = usable.filter((r) => r.start_time >= SPLIT);
const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

console.log(`=== 1. WHERE THE CONSTANTS COME FROM (${train.length} training matches) ===\n`);
for (const p of ['teamElo', 'heroWinRateShrunk', 'heroMatchup', 'heroGames']) {
  const gaps = train.map((r) => r.radiant[p] - r.dire[p]);
  const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((s, v) => s + (v - mean) ** 2, 0) / gaps.length);
  const sorted = [...gaps].sort((a, b) => a - b);
  console.log(`  ${p}`);
  console.log(`    average gap between the two sides : ${mean.toFixed(4)}`);
  console.log(`    typical size of that gap (sd)     : ${sd.toFixed(4)}`);
  console.log(
    `    for reference: half of all matches fall between ${sorted[Math.floor(sorted.length * 0.25)].toFixed(1)} and ${sorted[Math.floor(sorted.length * 0.75)].toFixed(1)}`,
  );
  console.log('');
}

function fit(params) {
  const rawDiff = (row) => params.map((p) => row.radiant[p] - row.dire[p]);
  const base = train.map(rawDiff);
  const means = params.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const stds = params.map(
    (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - means[i]) ** 2, 0) / base.length) || 1,
  );
  const encode = (row) => [...rawDiff(row).map((v, i) => (v - means[i]) / stds[i]), 1];
  const X = train.map(encode);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = new Array(params.length + 1).fill(0);
  for (let e = 0; e < 600; e += 1) {
    const g = new Array(w.length).fill(0);
    for (let i = 0; i < X.length; i += 1) {
      const err = sigmoid(X[i].reduce((s, v, j) => s + v * w[j], 0)) - y[i];
      for (let j = 0; j < w.length; j += 1) {
        g[j] += err * X[i][j];
      }
    }
    for (let j = 0; j < w.length; j += 1) {
      w[j] -= 0.5 * (g[j] / X.length + 1e-4 * w[j]);
    }
  }
  const probs = test.map((r) => sigmoid(encode(r).reduce((s, v, j) => s + v * w[j], 0)));
  const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;
  return { w, acc };
}

console.log('=== 2. WHAT HAPPENS WHEN Elo IS REMOVED ===\n');
const same = ['heroWinRateShrunk', 'heroMatchup', 'heroGames'];
const withElo = fit(['teamElo', ...same]);
const without = fit(same);

console.log('  the SAME three params, fitted with and without Elo beside them:\n');
console.log('  param                  with Elo   without Elo   change');
console.log('  ' + '-'.repeat(56));
same.forEach((p, i) => {
  const a = withElo.w[i + 1];
  const b = without.w[i];
  console.log(
    `  ${p.padEnd(22)} ${a.toFixed(4).padStart(8)}   ${b.toFixed(4).padStart(11)}   ${(((b - a) / Math.abs(a)) * 100).toFixed(0).padStart(5)}%`,
  );
});
console.log(
  `  ${'teamElo'.padEnd(22)} ${withElo.w[0].toFixed(4).padStart(8)}   ${'removed'.padStart(11)}`,
);
const droppedTotal = same.reduce((s, p, i) => s + (without.w[i] - withElo.w[i + 1]), 0);
console.log(`\n  Elo's coefficient was ${withElo.w[0].toFixed(4)}.`);
console.log(
  `  The other three grew by ${droppedTotal.toFixed(4)} in total — not by ${withElo.w[0].toFixed(4)}.`,
);
console.log(`  Nothing was split or moved. Every coefficient was learnt again from zero.`);
console.log(
  `\n  accuracy:  with Elo ${withElo.acc.toFixed(1)}%   without ${without.acc.toFixed(1)}%`,
);
