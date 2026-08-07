/** Does hero familiarity rank add anything to the model as it stands? */
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
  const d = (row) => params.map((p) => row.radiant[p] - row.dire[p]);
  const base = train.map(d);
  const mean = params.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const sd = params.map(
    (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
  );
  const enc = (row) => [...d(row).map((v, i) => (v - mean[i]) / sd[i]), 1];
  const X = train.map(enc);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = new Array(params.length + 1).fill(0);
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
  const probs = test.map((r) => sigmoid(enc(r).reduce((s, v, j) => s + v * w[j], 0)));
  const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;
  return { w, acc, params };
}

const now = fit(['heroWinRateShrunk', 'heroMatchup', 'heroGames']);
const plus = fit(['heroWinRateShrunk', 'heroMatchup', 'heroGames', 'heroRankScore']);

console.log(`  ${test.length} held-out matches\n`);
console.log(`  current 3 params      ${now.acc.toFixed(2)}%`);
console.log(`  with heroRank added   ${plus.acc.toFixed(2)}%`);
console.log(`\n  heroRank's fitted coefficient: ${plus.w[3].toFixed(4)}`);
console.log('  (the others, for scale:)');
plus.params
  .slice(0, 3)
  .forEach((p, i) => console.log(`    ${p.padEnd(20)} ${plus.w[i].toFixed(4)}`));
