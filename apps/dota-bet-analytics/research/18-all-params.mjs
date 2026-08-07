/**
 * The fair version of "what if we drop team strength".
 *
 * The earlier comparison used only the three params the production model
 * happens to carry, which stacks the deck: with Elo gone, params that were not
 * in that model — a player's overall record, how strong the heroes are this
 * patch — may well step up and take its place. This gives every version the
 * whole param set and lets the fit decide.
 *
 * Three versions:
 *   A  everything, Elo included
 *   B  everything except Elo
 *   C  everything except anything describing the team at all — because
 *      `teamWinRate` and `teamFormRecent` are team strength wearing a hat, and
 *      leaving them in would smuggle back the thing being removed.
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

const ALL = [
  'teamElo',
  'teamWinRate',
  'teamFormRecent',
  'teamGames',
  'playerWinRate',
  'playerGames',
  'heroWinRateShrunk',
  'heroWinRateRecent',
  'heroGames',
  'heroGamesRecent',
  'heroRankScore',
  'heroMatchup',
  'heroSynergy',
  'heroMeta',
];
const TEAM = ['teamElo', 'teamWinRate', 'teamFormRecent', 'teamGames'];

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
  const probs = test.map((r) => sigmoid(encode(r).reduce((s, v, j) => s + v * w[j], 0)));
  const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;
  return { params, w, acc };
}

const a = fit(ALL);
const b = fit(ALL.filter((p) => p !== 'teamElo'));
const c = fit(ALL.filter((p) => !TEAM.includes(p)));

console.log(`all three trained on ${train.length}, tested on ${test.length}\n`);
console.log(`  A  everything (${a.params.length} params)            ${a.acc.toFixed(1)}%`);
console.log(`  B  everything but Elo (${b.params.length} params)     ${b.acc.toFixed(1)}%`);
console.log(`  C  no team info at all (${c.params.length} params)    ${c.acc.toFixed(1)}%`);

const show = (label, m) => {
  console.log(`\n  ${label}`);
  m.params
    .map((p, i) => [p, m.w[i]])
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
    .slice(0, 6)
    .forEach(([p, v]) => console.log(`    ${p.padEnd(20)} ${v >= 0 ? '+' : ''}${v.toFixed(4)}`));
};
show('A — strongest params when Elo is there:', a);
show('B — strongest when Elo is removed:', b);
show('C — strongest with no team info at all:', c);
