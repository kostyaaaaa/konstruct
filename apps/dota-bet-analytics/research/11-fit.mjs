/**
 * Fit coefficients instead of guessing them.
 *
 * Hand-set coefficients were never going to work: params are on different
 * scales and correlate with each other, so the right weight for one depends on
 * which others are present. Logistic regression solves exactly that — it finds
 * the weights that best predict the winner, given all params together.
 *
 * Trained on 2023-2024, tested on 2025 onward. The split is by time, not
 * random: a random split would let the model learn from matches that happen
 * after the ones it is tested on, which is the same leak in a new costume.
 *
 * Written out longhand rather than pulling in a library — it is thirty lines,
 * and a dependency in a research folder is a dependency to audit.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

/** The params that survived step 10, plus Elo as the anchor. */
const PARAMS = [
  'teamElo',
  'heroWinRateShrunk',
  'playerWinRate',
  'heroMatchup',
  'heroSynergy',
  'heroMeta',
  'heroGames',
  'playerGames',
  'teamWinRate',
];

const usable = rows.filter(
  (r) =>
    r.start_time >= rows[0].start_time + 182 * 24 * 3600 &&
    r.radiant.teamGames > 20 &&
    r.dire.teamGames > 20,
);

const SPLIT = Date.parse('2025-01-01') / 1000;
const train = usable.filter((r) => r.start_time < SPLIT);
const test = usable.filter((r) => r.start_time >= SPLIT);

/** A match becomes one vector: how much more of each param Radiant had. */
const diff = (row) => [...PARAMS.map((p) => row.radiant[p] - row.dire[p]), 1];

/** Standardised on the training set only — the test set must stay unseen. */
const raw = train.map(diff);
const means = PARAMS.map((_, i) => raw.reduce((s, x) => s + x[i], 0) / raw.length);
const stds = PARAMS.map((_, i) => {
  const v = raw.reduce((s, x) => s + (x[i] - means[i]) ** 2, 0) / raw.length;
  return Math.sqrt(v) || 1;
});
const encode = (row) => {
  const d = diff(row);
  return [...PARAMS.map((_, i) => (d[i] - means[i]) / stds[i]), 1];
};

const X = train.map(encode);
const y = train.map((r) => (r.radiant_win ? 1 : 0));

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
let w = new Array(PARAMS.length + 1).fill(0);
const RATE = 0.5;
const L2 = 1e-4;

for (let epoch = 0; epoch < 400; epoch += 1) {
  const grad = new Array(w.length).fill(0);
  for (let i = 0; i < X.length; i += 1) {
    const p = sigmoid(X[i].reduce((s, v, j) => s + v * w[j], 0));
    const err = p - y[i];
    for (let j = 0; j < w.length; j += 1) {
      grad[j] += err * X[i][j];
    }
  }
  for (let j = 0; j < w.length; j += 1) {
    w[j] = w[j] - RATE * (grad[j] / X.length + L2 * w[j]);
  }
}

console.log(`trained on ${train.length} matches, testing on ${test.length}\n`);
console.log('  coefficient per param (standardised, so these ARE comparable):');
PARAMS.map((p, i) => [p, w[i]])
  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  .forEach(([p, c]) => console.log(`    ${p.padEnd(20)} ${c >= 0 ? '+' : ''}${c.toFixed(3)}`));

const logLoss = (probs, actual) =>
  -probs.reduce((s, p, i) => {
    const q = Math.min(0.999, Math.max(0.001, p));
    return s + (actual[i] ? Math.log(q) : Math.log(1 - q));
  }, 0) / probs.length;

const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const model = test.map((r) => sigmoid(encode(r).reduce((s, v, j) => s + v * w[j], 0)));
const elo = test.map((r) => 1 / (1 + 10 ** ((r.dire.teamElo - r.radiant.teamElo) / 540)));

const acc = (probs) =>
  (100 * probs.filter((p, i) => p > 0.5 === Boolean(testY[i])).length) / probs.length;

console.log(`\n  on the held-out period:`);
console.log(
  `    model    accuracy ${acc(model).toFixed(1)}%   log-loss ${logLoss(model, testY).toFixed(4)}`,
);
console.log(
  `    Elo only accuracy ${acc(elo).toFixed(1)}%   log-loss ${logLoss(elo, testY).toFixed(4)}`,
);

console.log('\n  betting only where the model disagrees with the price by more than X:');
console.log('    threshold   bets   won    fair price   edge    ±95%');
for (const t of [0, 0.02, 0.05, 0.08, 0.12]) {
  let bets = 0;
  let won = 0;
  let priced = 0;
  for (let i = 0; i < test.length; i += 1) {
    const backRadiant = model[i] > elo[i] + t;
    const backDire = 1 - model[i] > 1 - elo[i] + t;
    if (!backRadiant && !backDire) {
      continue;
    }
    bets += 1;
    won += (backRadiant ? testY[i] === 1 : testY[i] === 0) ? 1 : 0;
    priced += backRadiant ? elo[i] : 1 - elo[i];
  }
  if (bets < 50) {
    continue;
  }
  const hit = (100 * won) / bets;
  const fair = (100 * priced) / bets;
  const ci = 1.96 * Math.sqrt(0.25 / bets) * 100;
  console.log(
    `    ${`>${(100 * t).toFixed(0)}pp`.padEnd(11)}${String(bets).padStart(5)}  ${hit.toFixed(1)}%   ${fair.toFixed(1)}%      ${(hit - fair >= 0 ? '+' : '') + (hit - fair).toFixed(1)}    ${ci.toFixed(1)}`,
  );
}
