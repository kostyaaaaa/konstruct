/**
 * Hero win rate inside the current tournament, instead of a rolling window.
 *
 * The argument: a patch drops and a 90-day window is instantly stale, whereas
 * a tournament runs on one patch and has its own meta that players work out as
 * it goes.
 *
 * The risk: at prediction time only the matches already played in that
 * tournament are available, and the median tournament is 59 matches. Early on
 * there is nothing to go on.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const matches = new Map();
for (const l of readFileSync(`${dir}matches.jsonl`, 'utf8').split('\n')) {
  if (l) {
    const m = JSON.parse(l);
    matches.set(m.match_id, m);
  }
}
const rosters = new Map();
for (const l of readFileSync(`${dir}player-matches.jsonl`, 'utf8').split('\n')) {
  if (l) {
    const r = JSON.parse(l);
    if (!rosters.has(r.match_id)) {
      rosters.set(r.match_id, []);
    }
    rosters.get(r.match_id).push(r);
  }
}

const ordered = [...matches.values()]
  .filter((m) => rosters.get(m.match_id)?.length === 10)
  .sort((a, b) => a.start_time - b.start_time);

/** league -> hero -> [games, wins], and the same globally as a fallback. */
const inLeague = new Map();
const global = new Map();
const rate = (store, key, fallback) => {
  const r = store.get(key);
  return r && r[0] > 0 ? (r[1] / r[0]) * 100 : fallback;
};

const out = [];
for (const m of ordered) {
  const rs = rosters.get(m.match_id);
  const radiant = rs.filter((r) => r.player_slot < 128);
  const dire = rs.filter((r) => r.player_slot >= 128);

  const meta = (side, minGames) => {
    let total = 0;
    for (const p of side) {
      const key = `${m.leagueid}:${p.hero_id}`;
      const rec = inLeague.get(key);
      const enough = rec && rec[0] >= minGames;
      total += enough ? (rec[1] / rec[0]) * 100 : rate(global, p.hero_id, 50);
    }
    return total / side.length;
  };

  out.push({
    match_id: m.match_id,
    start_time: m.start_time,
    radiant_win: m.radiant_win,
    r3: meta(radiant, 3),
    d3: meta(dire, 3),
    r10: meta(radiant, 10),
    d10: meta(dire, 10),
  });

  for (const p of rs) {
    const won = p.player_slot < 128 === m.radiant_win;
    for (const [store, key] of [
      [inLeague, `${m.leagueid}:${p.hero_id}`],
      [global, p.hero_id],
    ]) {
      const r = store.get(key) ?? [0, 0];
      store.set(key, [r[0] + 1, r[1] + (won ? 1 : 0)]);
    }
  }
}

/* Bolt it onto the existing params and see if it earns a place. */
const params = new Map(
  readFileSync(`${dir}params.jsonl`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((r) => [r.match_id, r]),
);
const joined = out
  .filter((o) => params.has(o.match_id))
  .map((o) => ({ ...params.get(o.match_id), ...o }));

const usable = joined.filter((r) => r.start_time >= joined[0].start_time + 182 * 24 * 3600);
const SPLIT = Date.parse('2025-01-01') / 1000;
const train = usable.filter((r) => r.start_time < SPLIT);
const test = usable.filter((r) => r.start_time >= SPLIT);
const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const GAMES_SCALE = 17.1299;

function fit(get) {
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
  const enc = (row) => [...get(row).map((v, i) => (v - mean[i]) / sd[i]), 1];
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
  return {
    acc: (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length,
    w,
  };
}

const core = (r) => [
  r.radiant.heroWinRateShrunk - r.dire.heroWinRateShrunk,
  r.radiant.heroMatchup - r.dire.heroMatchup,
  Math.log(1 + r.radiant.heroGames) * GAMES_SCALE - Math.log(1 + r.dire.heroGames) * GAMES_SCALE,
];

console.log(`  ${test.length} held-out matches\n`);
console.log(`  current 3 params            ${fit(core).acc.toFixed(2)}%`);
console.log(
  `  + 90-day heroMeta           ${fit((r) => [...core(r), r.radiant.heroMeta - r.dire.heroMeta]).acc.toFixed(2)}%`,
);
const t3 = fit((r) => [...core(r), r.r3 - r.d3]);
const t10 = fit((r) => [...core(r), r.r10 - r.d10]);
console.log(`  + tournament meta (3+ games) ${t3.acc.toFixed(2)}%   weight ${t3.w[3].toFixed(4)}`);
console.log(
  `  + tournament meta (10+ games) ${t10.acc.toFixed(2)}%  weight ${t10.w[3].toFixed(4)}`,
);
