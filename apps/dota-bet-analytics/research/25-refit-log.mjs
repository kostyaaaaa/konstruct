/** Final weights with games on a log curve, flattened for a plain sum. */
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

const PARAMS = ['heroWinRate', 'heroMatchup', 'heroGamesLog'];
const value = (side, p) =>
  p === 'heroGamesLog'
    ? Math.log(1 + side.heroGames)
    : p === 'heroWinRate'
      ? side.heroWinRateShrunk
      : side[p];

const d = (row) => PARAMS.map((p) => value(row.radiant, p) - value(row.dire, p));
const base = train.map(d);
const mean = PARAMS.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
const sd = PARAMS.map(
  (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
);
const enc = (row) => [...d(row).map((v, i) => (v - mean[i]) / sd[i]), 1];

const X = train.map(enc);
const y = train.map((r) => (r.radiant_win ? 1 : 0));
let w = new Array(4).fill(0);
for (let e = 0; e < 900; e += 1) {
  const g = new Array(4).fill(0);
  for (let i = 0; i < X.length; i += 1) {
    const err = sigmoid(X[i].reduce((s, v, j) => s + v * w[j], 0)) - y[i];
    for (let j = 0; j < 4; j += 1) {
      g[j] += err * X[i][j];
    }
  }
  for (let j = 0; j < 4; j += 1) {
    w[j] -= 0.5 * (g[j] / X.length + 1e-4 * w[j]);
  }
}

const probs = test.map((r) => sigmoid(enc(r).reduce((s, v, j) => s + v * w[j], 0)));
const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;

/* Flatten to a plain sum, then rescale so the weights total 1. */
const flat = PARAMS.map((p, i) => w[i] / sd[i]);
let constant = w[3];
PARAMS.forEach((p, i) => (constant -= (w[i] * mean[i]) / sd[i]));
const total = flat.reduce((s, v) => s + v, 0);

console.log(`  held-out accuracy: ${acc.toFixed(2)}%\n`);
console.log('  WEIGHTS = {');
PARAMS.forEach((p, i) => console.log(`    ${p}: ${(flat[i] / total).toFixed(4)},`));
console.log(`  }\n  RADIANT_BONUS = ${(constant / total).toFixed(4)}`);

/* Confirm the flat form picks identically. */
let same = 0;
for (const r of test) {
  const z = enc(r).reduce((s, v, j) => s + v * w[j], 0);
  const score = (side, isR) =>
    PARAMS.reduce((s, p, i) => s + (flat[i] / total) * value(side, p), 0) +
    (isR ? constant / total : 0);
  if (z > 0 === score(r.radiant, true) > score(r.dire, false)) {
    same += 1;
  }
}
console.log(`\n  flat form agrees with the fit on ${same}/${test.length} matches`);
