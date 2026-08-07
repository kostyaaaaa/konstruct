/**
 * The production model with team strength removed.
 *
 * Three params, and they are the three the app can compute at prediction time
 * without new infrastructure: the players' records on the heroes they picked,
 * how many games they have on them, and how those five heroes fare against the
 * other five.
 *
 * Every coefficient is fitted from scratch. Removing a param does not free up
 * its weight to be shared out — the others are relearned, and they change by
 * whatever the data says.
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

const PARAMS = ['heroWinRateShrunk', 'heroMatchup', 'heroGames'];

const rawDiff = (row) => PARAMS.map((p) => row.radiant[p] - row.dire[p]);
const base = train.map(rawDiff);
const means = PARAMS.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
const stds = PARAMS.map(
  (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - means[i]) ** 2, 0) / base.length) || 1,
);
const encode = (row) => [...rawDiff(row).map((v, i) => (v - means[i]) / stds[i]), 1];

const X = train.map(encode);
const y = train.map((r) => (r.radiant_win ? 1 : 0));
let w = new Array(PARAMS.length + 1).fill(0);
for (let e = 0; e < 800; e += 1) {
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
const ci = 1.96 * Math.sqrt(0.25 / probs.length) * 100;

console.log(`trained on ${train.length}, tested on ${test.length}\n`);
console.log('  COEFFICIENTS = {');
PARAMS.forEach((p, i) => console.log(`    ${p}: ${w[i].toFixed(4)},`));
console.log(`    intercept: ${w[PARAMS.length].toFixed(4)},`);
console.log('  }\n  STANDARDISE = {');
PARAMS.forEach((p, i) =>
  console.log(`    ${p}: { mean: ${means[i].toFixed(4)}, sd: ${stds[i].toFixed(4)} },`),
);
console.log('  }\n');
console.log(`  held-out accuracy: ${acc.toFixed(1)}% ±${ci.toFixed(1)}`);
console.log(`  (the version with team strength scored 61.6%; always-Radiant scores 52.2%)`);

console.log('\n  accuracy by confidence:');
for (const t of [0.5, 0.55, 0.6, 0.65]) {
  const picked = probs.map((p, i) => [p, i]).filter(([p]) => Math.abs(p - 0.5) >= t - 0.5);
  if (picked.length < 100) {
    continue;
  }
  const right = picked.filter(([p, i]) => p > 0.5 === Boolean(testY[i])).length;
  const c = 1.96 * Math.sqrt(0.25 / picked.length) * 100;
  console.log(
    `    p >= ${t.toFixed(2)}   ${((100 * right) / picked.length).toFixed(1)}% on ${String(picked.length).padStart(5)}  ±${c.toFixed(1)}`,
  );
}
