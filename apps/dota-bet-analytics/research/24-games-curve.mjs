/**
 * How should games-on-hero enter the model?
 *
 * Linear says 1000 games is twice 500, which is nonsense — the gap between 10
 * and 100 games is real, the gap between 500 and 1000 is not. These are curves
 * that flatten out, tested against each other.
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

const CURVES = {
  'linear (now)': (g) => g,
  'square root': (g) => Math.sqrt(g),
  log: (g) => Math.log(1 + g),
  'capped at 50': (g) => Math.min(g, 50),
  'capped at 100': (g) => Math.min(g, 100),
  'saturating g/(g+30)': (g) => (100 * g) / (g + 30),
  'saturating g/(g+100)': (g) => (100 * g) / (g + 100),
};

function fit(curve) {
  const d = (row) => [
    row.radiant.heroWinRateShrunk - row.dire.heroWinRateShrunk,
    row.radiant.heroMatchup - row.dire.heroMatchup,
    curve(row.radiant.heroGames) - curve(row.dire.heroGames),
  ];
  const base = train.map(d);
  const mean = [0, 1, 2].map((i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const sd = [0, 1, 2].map(
    (i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
  );
  const enc = (row) => [...d(row).map((v, i) => (v - mean[i]) / sd[i]), 1];
  const X = train.map(enc);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = [0, 0, 0, 0];
  for (let e = 0; e < 800; e += 1) {
    const g = [0, 0, 0, 0];
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
  return {
    acc: (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length,
    w: w[2],
  };
}

console.log(`  ${test.length} held-out matches\n`);
console.log('  curve                    accuracy   weight on games');
for (const [name, fn] of Object.entries(CURVES)) {
  const { acc, w } = fit(fn);
  console.log(`  ${name.padEnd(24)} ${acc.toFixed(2)}%      ${w.toFixed(4)}`);
}

console.log('\n  what each curve says 10 / 100 / 500 / 1000 games is worth:');
for (const [name, fn] of Object.entries(CURVES)) {
  const v = [10, 100, 500, 1000].map((g) => fn(g));
  const rel = v.map((x) => (x / v[1]).toFixed(2));
  console.log(`  ${name.padEnd(24)} ${rel.join('   ')}   (100 games = 1.00)`);
}
