/**
 * Does ladder rank improve the current model?
 *
 * Scored on the last 90 days only. OpenDota keeps no history of ladder rank,
 * so the value fetched is today's — honest for a recent match, future
 * information for an old one.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const read = (f) =>
  readFileSync(`${dir}${f}`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

const profiles = new Map(read('player-profiles.jsonl').map((p) => [p.account_id, p]));
const rosters = new Map();
for (const r of read('player-matches.jsonl')) {
  if (!rosters.has(r.match_id)) {
    rosters.set(r.match_id, []);
  }
  rosters.get(r.match_id).push(r);
}

const params = read('params.jsonl');
const latest = Math.max(...params.map((p) => p.start_time));
const LADDER_FLOOR = 5000;

const ladder = (players) => {
  let score = 0;
  for (const p of players) {
    const rank = profiles.get(p.account_id)?.leaderboard_rank;
    score += rank ? (Math.max(0, LADDER_FLOOR - rank) / LADDER_FLOOR) * 100 : 0;
  }
  return score / players.length;
};

const window = params
  .filter((p) => p.start_time >= latest - 90 * 24 * 3600 && rosters.has(p.match_id))
  .map((row) => {
    const rs = rosters.get(row.match_id);
    return {
      ...row,
      radiant: { ...row.radiant, ladderScore: ladder(rs.filter((r) => r.player_slot < 128)) },
      dire: { ...row.dire, ladderScore: ladder(rs.filter((r) => r.player_slot >= 128)) },
    };
  });

/* Half to fit on, half to check — the window is too small to spare a year. */
const mid = Math.floor(window.length / 2);
const train = window.slice(0, mid);
const test = window.slice(mid);
const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function fit(list) {
  const d = (row) => list.map((p) => row.radiant[p] - row.dire[p]);
  const base = train.map(d);
  const mean = list.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const sd = list.map(
    (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
  );
  const enc = (row) => [...d(row).map((v, i) => (v - mean[i]) / sd[i]), 1];
  const X = train.map(enc);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = new Array(list.length + 1).fill(0);
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
  return { w, acc, list };
}

const now = fit(['heroWinRateShrunk', 'heroMatchup', 'heroGames']);
const plus = fit(['heroWinRateShrunk', 'heroMatchup', 'heroGames', 'ladderScore']);
const ci = 1.96 * Math.sqrt(0.25 / test.length) * 100;

console.log(
  `  ${window.length} matches in the window, ${test.length} used to check  (±${ci.toFixed(1)})\n`,
);
console.log(`  current 3 params        ${now.acc.toFixed(1)}%`);
console.log(`  with ladder rank        ${plus.acc.toFixed(1)}%`);
console.log(`\n  fitted coefficients with ladder in:`);
plus.list.forEach((p, i) =>
  console.log(`    ${p.padEnd(20)} ${plus.w[i] >= 0 ? '+' : ''}${plus.w[i].toFixed(4)}`),
);
