/**
 * The model production can run once it has a team ratings store.
 *
 * Exactly three params: the two it already fetches, plus team Elo. Step 11
 * fitted nine, but six of them need a matchup matrix and extra OpenDota calls
 * that do not exist yet — coefficients from that fit would be wrong here,
 * because a coefficient depends on which other params are present.
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

const PARAMS = ['heroWinRateShrunk', 'heroGames', 'teamElo'];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
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

for (let epoch = 0; epoch < 600; epoch += 1) {
  const grad = new Array(w.length).fill(0);
  for (let i = 0; i < X.length; i += 1) {
    const err = sigmoid(X[i].reduce((s, v, j) => s + v * w[j], 0)) - y[i];
    for (let j = 0; j < w.length; j += 1) {
      grad[j] += err * X[i][j];
    }
  }
  for (let j = 0; j < w.length; j += 1) {
    w[j] -= 0.5 * (grad[j] / X.length + 1e-4 * w[j]);
  }
}

const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const probs = test.map((r) => sigmoid(encode(r).reduce((s, v, j) => s + v * w[j], 0)));
const acc = (p) => (100 * p.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / p.length;
const loss = (p) =>
  -p.reduce((s, v, i) => {
    const q = Math.min(0.999, Math.max(0.001, v));
    return s + (testY[i] ? Math.log(q) : Math.log(1 - q));
  }, 0) / p.length;

const v2 = test.map((r) => {
  const z =
    0.0755 +
    0.3526 * ((r.radiant.heroWinRateShrunk - r.dire.heroWinRateShrunk + 0.0037) / 5.8007) +
    0.0496 * ((r.radiant.heroGames - r.dire.heroGames + 0.0768) / 27.9203);
  return sigmoid(z);
});

console.log(`train ${train.length}, test ${test.length}\n`);
console.log('  COEFFICIENTS = {');
PARAMS.forEach((p, i) => console.log(`    ${p}: ${w[i].toFixed(4)},`));
console.log(`    intercept: ${w[PARAMS.length].toFixed(4)},`);
console.log('  }\n  STANDARDISE = {');
PARAMS.forEach((p, i) =>
  console.log(`    ${p}: { mean: ${means[i].toFixed(4)}, sd: ${stds[i].toFixed(4)} },`),
);
console.log('  }\n');
console.log(`  held-out accuracy:`);
console.log(`    v2 (shipping now)   ${acc(v2).toFixed(1)}%   log-loss ${loss(v2).toFixed(4)}`);
console.log(
  `    v3 (with Elo)       ${acc(probs).toFixed(1)}%   log-loss ${loss(probs).toFixed(4)}`,
);
console.log('\n  accuracy by confidence, v3:');
for (const t of [0.5, 0.55, 0.6, 0.65, 0.7]) {
  const picked = probs.map((p, i) => [p, i]).filter(([p]) => Math.abs(p - 0.5) >= t - 0.5);
  if (picked.length < 100) {
    continue;
  }
  const right = picked.filter(([p, i]) => p > 0.5 === Boolean(testY[i])).length;
  const ci = 1.96 * Math.sqrt(0.25 / picked.length) * 100;
  console.log(
    `    p >= ${t.toFixed(2)}   ${((100 * right) / picked.length).toFixed(1)}% on ${String(picked.length).padStart(5)} matches  ±${ci.toFixed(1)}`,
  );
}
