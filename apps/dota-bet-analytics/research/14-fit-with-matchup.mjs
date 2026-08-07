/**
 * Model v4: team strength, hero record, and the draft.
 *
 * Fits two candidates — with and without hero synergy — because synergy was
 * the weakest param that survived and an extra input has to earn its place
 * rather than be assumed useful.
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

  const probs = test.map((r) => sigmoid(encode(r).reduce((s, v, j) => s + v * w[j], 0)));
  const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;
  const loss =
    -probs.reduce((s, v, i) => {
      const q = Math.min(0.999, Math.max(0.001, v));
      return s + (testY[i] ? Math.log(q) : Math.log(1 - q));
    }, 0) / probs.length;
  return { params, w, means, stds, acc, loss, probs };
}

const v3 = fit(['heroWinRateShrunk', 'heroGames', 'teamElo']);
const v4 = fit(['heroWinRateShrunk', 'heroGames', 'teamElo', 'heroMatchup']);
const v4s = fit(['heroWinRateShrunk', 'heroGames', 'teamElo', 'heroMatchup', 'heroSynergy']);

for (const [name, m] of [
  ['v3 (shipping)', v3],
  ['v4 + matchup', v4],
  ['v4 + matchup + synergy', v4s],
]) {
  console.log(`  ${name.padEnd(24)} ${m.acc.toFixed(2)}%   log-loss ${m.loss.toFixed(4)}`);
}

const chosen = v4;
console.log('\n  COEFFICIENTS = {');
chosen.params.forEach((p, i) => console.log(`    ${p}: ${chosen.w[i].toFixed(4)},`));
console.log(`    intercept: ${chosen.w[chosen.params.length].toFixed(4)},`);
console.log('  }\n  STANDARDISE = {');
chosen.params.forEach((p, i) =>
  console.log(
    `    ${p}: { mean: ${chosen.means[i].toFixed(4)}, sd: ${chosen.stds[i].toFixed(4)} },`,
  ),
);
console.log('  }');

console.log('\n  accuracy by confidence, v4:');
for (const t of [0.5, 0.55, 0.6, 0.65, 0.7]) {
  const picked = chosen.probs.map((p, i) => [p, i]).filter(([p]) => Math.abs(p - 0.5) >= t - 0.5);
  if (picked.length < 100) {
    continue;
  }
  const right = picked.filter(([p, i]) => p > 0.5 === Boolean(testY[i])).length;
  const ci = 1.96 * Math.sqrt(0.25 / picked.length) * 100;
  console.log(
    `    p >= ${t.toFixed(2)}   ${((100 * right) / picked.length).toFixed(1)}% on ${String(picked.length).padStart(5)}  ±${ci.toFixed(1)}`,
  );
}
