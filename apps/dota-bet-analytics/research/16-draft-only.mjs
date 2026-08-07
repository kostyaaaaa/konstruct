/**
 * A draft-only score, fitted and measured the same way as the full model.
 *
 * The 54% figure quoted earlier came from a different test — one raw param on
 * the whole dataset, not a fitted model on held-out matches — so it could not
 * be compared with the full model's 61.6%. This measures both on the same
 * 2025-onward matches, neither of which either model saw while training.
 *
 * "Draft" here means the heroes only: how they fare against the other five,
 * how strong they are this patch, and how they work together. A player's
 * record on a hero is deliberately left out — that is the player, not the pick.
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
  const ci = 1.96 * Math.sqrt(0.25 / probs.length) * 100;
  return { params, w, means, stds, acc, ci };
}

const full = fit(['teamElo', 'heroWinRateShrunk', 'heroMatchup', 'heroGames']);
const draft = fit(['heroMatchup', 'heroMeta', 'heroSynergy']);

console.log(`both trained on ${train.length} matches, both tested on the same ${test.length}\n`);
for (const [name, m] of [
  ['full model', full],
  ['draft only', draft],
]) {
  console.log(`  ${name.padEnd(12)} ${m.acc.toFixed(1)}% ±${m.ci.toFixed(1)}`);
}

console.log('\n  DRAFT-ONLY FORMULA');
console.log(`    z = ${draft.w[draft.params.length].toFixed(4)}`);
draft.params.forEach((p, i) => {
  console.log(
    `      + ${draft.w[i].toFixed(4)} x (delta_${p} ${draft.means[i] >= 0 ? '-' : '+'} ${Math.abs(draft.means[i]).toFixed(4)}) / ${draft.stds[i].toFixed(4)}`,
  );
});
console.log('    score = 1 / (1 + e^-z)');
