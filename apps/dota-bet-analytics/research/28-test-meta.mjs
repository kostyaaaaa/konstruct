/** Does hero meta strength add anything to the model as it stands? */
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
const val = (s, p) =>
  p === 'heroGames'
    ? Math.log(1 + s.heroGames) * GAMES_SCALE
    : p === 'heroWinRate'
      ? s.heroWinRateShrunk
      : s[p];

function fit(P) {
  const d = (row) => P.map((p) => val(row.radiant, p) - val(row.dire, p));
  const base = train.map(d);
  const mean = P.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const sd = P.map(
    (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
  );
  const enc = (row) => [...d(row).map((v, i) => (v - mean[i]) / sd[i]), 1];
  const X = train.map(enc);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = new Array(P.length + 1).fill(0);
  for (let e = 0; e < 900; e += 1) {
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
  return {
    acc: (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length,
    w,
    P,
  };
}

const now = fit(['heroWinRate', 'heroMatchup', 'heroGames']);
const plus = fit(['heroWinRate', 'heroMatchup', 'heroGames', 'heroMeta']);
console.log(`  ${test.length} held-out matches\n`);
console.log(`  current 3 params    ${now.acc.toFixed(2)}%`);
console.log(`  with heroMeta       ${plus.acc.toFixed(2)}%\n`);
plus.P.forEach((p, i) =>
  console.log(`    ${p.padEnd(14)} ${plus.w[i] >= 0 ? '+' : ''}${plus.w[i].toFixed(4)}`),
);
