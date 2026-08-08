/**
 * Six ways to turn 25 hero pairings into one number.
 *
 * The current mean is not wrong so much as blunt: it cannot tell one hard
 * counter from twenty-five mild ones. Rescaling would not help — the fit
 * absorbs any linear change — so these are all genuinely different summaries.
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

const wins = new Map(); // "a:b" -> [wins, games]
const cell = (a, b) => {
  const r = wins.get(`${a}:${b}`);
  return r && r[1] > 0 ? { rate: (100 * r[0]) / r[1], games: r[1] } : { rate: 50, games: 0 };
};

const SHAPES = {
  mean: (c) => c.reduce((s, x) => s + x.rate, 0) / c.length,
  weighted: (c) => {
    const g = c.reduce((s, x) => s + x.games, 0);
    return g ? c.reduce((s, x) => s + x.rate * x.games, 0) / g : 50;
  },
  worstPerHero: (c, perHero) =>
    perHero.reduce((s, row) => s + Math.min(...row.map((x) => x.rate)), 0) / perHero.length,
  singleWorst: (c) => Math.min(...c.map((x) => x.rate)),
  median: (c) => {
    const v = c.map((x) => x.rate).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  },
  countBad: (c) => c.filter((x) => x.rate < 45).length,
};

const out = [];
for (const m of ordered) {
  const rs = rosters.get(m.match_id);
  const R = rs.filter((r) => r.player_slot < 128).map((r) => r.hero_id);
  const D = rs.filter((r) => r.player_slot >= 128).map((r) => r.hero_id);

  const build = (ours, theirs) => {
    const perHero = ours.map((a) => theirs.map((b) => cell(a, b)));
    const flat = perHero.flat();
    return Object.fromEntries(Object.entries(SHAPES).map(([k, fn]) => [k, fn(flat, perHero)]));
  };

  out.push({
    match_id: m.match_id,
    start_time: m.start_time,
    radiant_win: m.radiant_win,
    R: build(R, D),
    D: build(D, R),
  });

  const W = m.radiant_win ? R : D;
  const L = m.radiant_win ? D : R;
  for (const w of W) {
    for (const l of L) {
      const up = wins.get(`${w}:${l}`) ?? [0, 0];
      wins.set(`${w}:${l}`, [up[0] + 1, up[1] + 1]);
      const dn = wins.get(`${l}:${w}`) ?? [0, 0];
      wins.set(`${l}:${w}`, [dn[0], dn[1] + 1]);
    }
  }
}

const params = new Map(
  readFileSync(`${dir}params.jsonl`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((r) => [r.match_id, r]),
);
const joined = out
  .filter((o) => params.has(o.match_id))
  .map((o) => ({ ...o, p: params.get(o.match_id) }));
const usable = joined.filter((r) => r.start_time >= joined[0].start_time + 182 * 24 * 3600);
const SPLIT = Date.parse('2025-01-01') / 1000;
const train = usable.filter((r) => r.start_time < SPLIT);
const test = usable.filter((r) => r.start_time >= SPLIT);
const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const G = 17.1299;

function fit(shape) {
  const d = (r) => [
    r.p.radiant.heroWinRateShrunk - r.p.dire.heroWinRateShrunk,
    r.R[shape] - r.D[shape],
    Math.log(1 + r.p.radiant.heroGames) * G - Math.log(1 + r.p.dire.heroGames) * G,
  ];
  const base = train.map(d);
  const mean = [0, 1, 2].map((i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const sd = [0, 1, 2].map(
    (i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
  );
  const enc = (r) => [...d(r).map((v, i) => (v - mean[i]) / sd[i]), 1];
  const X = train.map(enc);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = [0, 0, 0, 0];
  for (let e = 0; e < 900; e += 1) {
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
  const gaps = test.map((r) => Math.abs(r.R[shape] - r.D[shape])).sort((a, b) => a - b);
  return {
    acc: (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length,
    w: w[1],
    gap: gaps[Math.floor(gaps.length / 2)],
  };
}

console.log(`  ${test.length} held-out matches\n`);
console.log('  shape           accuracy   weight   typical gap');
for (const s of Object.keys(SHAPES)) {
  const r = fit(s);
  console.log(
    `  ${s.padEnd(14)} ${r.acc.toFixed(2)}%   ${r.w.toFixed(4).padStart(7)}   ${r.gap.toFixed(2)}`,
  );
}

/* Do two summaries see different things? If the pair beats both singly, the
   mean was hiding something a second view recovers. */
function fitPair(a, b) {
  const d = (r) => [
    r.p.radiant.heroWinRateShrunk - r.p.dire.heroWinRateShrunk,
    r.R[a] - r.D[a],
    r.R[b] - r.D[b],
    Math.log(1 + r.p.radiant.heroGames) * G - Math.log(1 + r.p.dire.heroGames) * G,
  ];
  const base = train.map(d);
  const n = 4;
  const mean = [...Array(n).keys()].map((i) => base.reduce((s, x) => s + x[i], 0) / base.length);
  const sd = [...Array(n).keys()].map(
    (i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
  );
  const enc = (r) => [...d(r).map((v, i) => (v - mean[i]) / sd[i]), 1];
  const X = train.map(enc);
  const y = train.map((r) => (r.radiant_win ? 1 : 0));
  let w = new Array(n + 1).fill(0);
  for (let e = 0; e < 900; e += 1) {
    const g = new Array(n + 1).fill(0);
    for (let i = 0; i < X.length; i += 1) {
      const err = sigmoid(X[i].reduce((s, v, j) => s + v * w[j], 0)) - y[i];
      for (let j = 0; j <= n; j += 1) {
        g[j] += err * X[i][j];
      }
    }
    for (let j = 0; j <= n; j += 1) {
      w[j] -= 0.5 * (g[j] / X.length + 1e-4 * w[j]);
    }
  }
  const probs = test.map((r) => sigmoid(enc(r).reduce((s, v, j) => s + v * w[j], 0)));
  return (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;
}

console.log('\n  two summaries together:');
for (const [a, b] of [
  ['mean', 'countBad'],
  ['mean', 'singleWorst'],
  ['median', 'countBad'],
]) {
  console.log(`  ${(a + ' + ' + b).padEnd(24)} ${fitPair(a, b).toFixed(2)}%`);
}
