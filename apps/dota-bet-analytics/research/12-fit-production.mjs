/**
 * The best model production can run *today*.
 *
 * Step 11 fitted everything, including team Elo and the matchup matrix. The
 * app has neither — those need stores that are built and kept up to date, and
 * that is real work. This fits only the params production already fetches from
 * OpenDota at prediction time, so it can ship without new infrastructure.
 *
 * Same time split: train on 2023-2024, test on 2025 onward.
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

/** Everything here comes from `/players/{id}/heroes`, which production already calls. */
const PARAMS = ['heroWinRateShrunk', 'heroGames'];

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

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

  for (let epoch = 0; epoch < 500; epoch += 1) {
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
  return { w, means, stds, encode };
}

const model = fit(PARAMS);
const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const probs = test.map((r) => sigmoid(model.encode(r).reduce((s, v, j) => s + v * model.w[j], 0)));

const acc = (p) => (100 * p.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / p.length;
const loss = (p) =>
  -p.reduce((s, v, i) => {
    const q = Math.min(0.999, Math.max(0.001, v));
    return s + (testY[i] ? Math.log(q) : Math.log(1 - q));
  }, 0) / p.length;

/* What production does today, for comparison, on the same held-out matches. */
const current = test.map((r) => {
  const rs = r.radiant.heroWinRate * 0.8 + r.radiant.heroRankScore * 0.2;
  const ds = r.dire.heroWinRate * 0.8 + r.dire.heroRankScore * 0.2;
  return rs === ds ? 0.5 : rs > ds ? 0.51 : 0.49;
});

console.log(`train ${train.length}, test ${test.length}\n`);
console.log('  coefficients (standardised):');
PARAMS.forEach((p, i) =>
  console.log(`    ${p.padEnd(20)} ${model.w[i] >= 0 ? '+' : ''}${model.w[i].toFixed(4)}`),
);
console.log(
  `    ${'intercept'.padEnd(20)} ${model.w[PARAMS.length] >= 0 ? '+' : ''}${model.w[PARAMS.length].toFixed(4)}   <- the Radiant advantage`,
);
console.log('\n  standardisation (needed to run this in the app):');
PARAMS.forEach((p, i) =>
  console.log(
    `    ${p.padEnd(20)} mean ${model.means[i].toFixed(4)}  sd ${model.stds[i].toFixed(4)}`,
  ),
);

console.log(`\n  held-out accuracy:`);
console.log(`    production today   ${acc(current).toFixed(1)}%`);
console.log(
  `    fitted, same data  ${acc(probs).toFixed(1)}%   log-loss ${loss(probs).toFixed(4)}`,
);

console.log('\n  accuracy by confidence, fitted model:');
for (const t of [0.5, 0.53, 0.56, 0.6]) {
  const picked = probs.map((p, i) => [p, i]).filter(([p]) => Math.abs(p - 0.5) >= t - 0.5);
  if (picked.length < 100) {
    continue;
  }
  const right = picked.filter(([p, i]) => p > 0.5 === Boolean(testY[i])).length;
  const ci = 1.96 * Math.sqrt(0.25 / picked.length) * 100;
  console.log(
    `    p >= ${t.toFixed(2)}   ${((100 * right) / picked.length).toFixed(1)}% on ${picked.length} matches  ±${ci.toFixed(1)}`,
  );
}
