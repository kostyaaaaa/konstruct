/**
 * Should games and win rate multiply rather than add?
 *
 * Added together, volume earns points on its own — 45% over 500 games outscores
 * 51% over 10. Multiplied, experience amplifies a record in whichever direction
 * it points: lots of games at 45% becomes strongly negative, not strongly
 * positive.
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
const G = 17.1299;
const games = (s) => Math.log(1 + s.heroGames) * G;

function fit(get, label) {
  const base = train.map(get);
  const n = base[0].length;
  const mean = Array.from(
    { length: n },
    (_, i) => base.reduce((s, x) => s + x[i], 0) / base.length,
  );
  const sd = Array.from(
    { length: n },
    (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
  );
  const enc = (r) => [...get(r).map((v, i) => (v - mean[i]) / sd[i]), 1];
  const X = train.map(enc);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = new Array(n + 1).fill(0);
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
  const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;
  console.log(`  ${label.padEnd(46)} ${acc.toFixed(2)}%`);
  return { acc, w, mean, sd };
}

const M = (r) => r.radiant.heroMatchup - r.dire.heroMatchup;
/** (win rate − 50) × log games: a record weighted by how much of it there is. */
const conf = (s) => (s.heroWinRateShrunk - 50) * (games(s) / 100);

fit(
  (r) => [
    r.radiant.heroWinRateShrunk - r.dire.heroWinRateShrunk,
    M(r),
    games(r.radiant) - games(r.dire),
  ],
  'now: winRate + games added',
);
fit((r) => [conf(r.radiant) - conf(r.dire), M(r)], 'multiplied: (winRate-50) x games');
const both = fit(
  (r) => [
    r.radiant.heroWinRateShrunk - r.dire.heroWinRateShrunk,
    M(r),
    games(r.radiant) - games(r.dire),
    conf(r.radiant) - conf(r.dire),
  ],
  'both added and multiplied',
);
console.log('\n  weights when both are offered:');
['heroWinRate', 'heroMatchup', 'heroGames', 'interaction'].forEach((p, i) =>
  console.log(`    ${p.padEnd(14)} ${both.w[i] >= 0 ? '+' : ''}${both.w[i].toFixed(4)}`),
);
