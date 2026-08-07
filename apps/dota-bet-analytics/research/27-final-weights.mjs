/** Weights with raw matchup percentages, flattened and rescaled to sum to 1. */
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
const GAMES_SCALE = 17.1299;

const P = ['heroWinRate', 'heroMatchup', 'heroGames'];
const val = (s, p) =>
  p === 'heroGames'
    ? Math.log(1 + s.heroGames) * GAMES_SCALE
    : p === 'heroWinRate'
      ? s.heroWinRateShrunk
      : s[p];
const d = (row) => P.map((p) => val(row.radiant, p) - val(row.dire, p));
const base = train.map(d);
const mean = P.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
const sd = P.map(
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

const flat = P.map((_, i) => w[i] / sd[i]);
let constant = w[3];
P.forEach((_, i) => (constant -= (w[i] * mean[i]) / sd[i]));
const total = flat.reduce((s, v) => s + v, 0);
console.log(`  held-out ${acc.toFixed(2)}%\n`);
console.log('  WEIGHTS = {');
P.forEach((p, i) => console.log(`    ${p}: ${(flat[i] / total).toFixed(4)},`));
console.log(`  }\n  RADIANT_BONUS = ${(constant / total).toFixed(4)}`);
