/**
 * A hero-matchup matrix from public matches, tested against the pro one.
 *
 * The pro matrix is the right population but too thin — median 115 games per
 * pairing, so most cells are noise pulled toward 50. The pub matrix has orders
 * of magnitude more data but comes from a different game: All Pick with five
 * strangers, not Captains Mode with bans and coordination.
 *
 * Whether precision beats relevance is not something to reason out, so both
 * are fitted and compared on the same held-out matches.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;

/* --- build the pub matrix --- */
const pubWins = new Map();
let counted = 0;
for (const line of readFileSync(`${dir}pub-matches.jsonl`, 'utf8').split('\n')) {
  if (!line) {
    continue;
  }
  for (const m of JSON.parse(line).m) {
    const W = m.radiant_win ? m.radiant_team : m.dire_team;
    const L = m.radiant_win ? m.dire_team : m.radiant_team;
    for (const w of W) {
      for (const l of L) {
        const up = pubWins.get(`${w}:${l}`) ?? [0, 0];
        pubWins.set(`${w}:${l}`, [up[0] + 1, up[1] + 1]);
        const dn = pubWins.get(`${l}:${w}`) ?? [0, 0];
        pubWins.set(`${l}:${w}`, [dn[0], dn[1] + 1]);
      }
    }
    counted += 1;
  }
}
const counts = [...pubWins.values()].map(([, g]) => g).sort((a, b) => a - b);
console.log(
  `  pub matrix: ${counted.toLocaleString()} matches -> ${pubWins.size.toLocaleString()} cells`,
);
console.log(
  `  games per cell: median ${counts[Math.floor(counts.length / 2)].toLocaleString()}, min ${counts[0]}`,
);

/* --- the pro matrix, rebuilt here so both are computed identically --- */
const matches = new Map();
for (const l of readFileSync(`${dir}matches.jsonl`, 'utf8').split('\n')) {
  if (l) {
    const m = JSON.parse(l);
    matches.set(m.match_id, m);
  }
}
const rosters = new Map();
for (const l of readFileSync(`${dir}player-matches.jsonl`, 'utf8').split('\n')) {
  if (!l) {
    continue;
  }
  const r = JSON.parse(l);
  if (!rosters.has(r.match_id)) {
    rosters.set(r.match_id, []);
  }
  rosters.get(r.match_id).push(r);
}
const ordered = [...matches.values()]
  .filter((m) => rosters.get(m.match_id)?.length === 10)
  .sort((a, b) => a.start_time - b.start_time);

const proWins = new Map();
const rate = (store, a, b) => {
  const r = store.get(`${a}:${b}`);
  return r && r[1] > 0 ? (100 * r[0]) / r[1] : 50;
};

const rows = [];
for (const m of ordered) {
  const rs = rosters.get(m.match_id);
  const R = rs.filter((x) => x.player_slot < 128).map((x) => x.hero_id);
  const D = rs.filter((x) => x.player_slot >= 128).map((x) => x.hero_id);
  const mean = (store, ours, theirs) =>
    ours.reduce(
      (s, a) => s + theirs.reduce((t, b) => t + rate(store, a, b), 0) / theirs.length,
      0,
    ) / ours.length;

  rows.push({
    match_id: m.match_id,
    start_time: m.start_time,
    radiant_win: m.radiant_win,
    proR: mean(proWins, R, D),
    proD: mean(proWins, D, R),
    pubR: mean(pubWins, R, D),
    pubD: mean(pubWins, D, R),
  });

  const W = m.radiant_win ? R : D;
  const L = m.radiant_win ? D : R;
  for (const w of W) {
    for (const l of L) {
      const up = proWins.get(`${w}:${l}`) ?? [0, 0];
      proWins.set(`${w}:${l}`, [up[0] + 1, up[1] + 1]);
      const dn = proWins.get(`${l}:${w}`) ?? [0, 0];
      proWins.set(`${l}:${w}`, [dn[0], dn[1] + 1]);
    }
  }
}

/* --- fit --- */
const params = new Map(
  readFileSync(`${dir}params.jsonl`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .map((r) => [r.match_id, r]),
);
const joined = rows
  .filter((r) => params.has(r.match_id))
  .map((r) => ({ ...r, p: params.get(r.match_id) }));
const usable = joined.filter((r) => r.start_time >= joined[0].start_time + 182 * 24 * 3600);
const SPLIT = Date.parse('2025-01-01') / 1000;
const train = usable.filter((r) => r.start_time < SPLIT);
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const G = 17.1299;

function run(label, getMatchup, testSet) {
  const testY = testSet.map((r) => (r.radiant_win ? 1 : 0));
  const d = (r) => [
    r.p.radiant.heroWinRateShrunk - r.p.dire.heroWinRateShrunk,
    ...getMatchup(r),
    Math.log(1 + r.p.radiant.heroGames) * G - Math.log(1 + r.p.dire.heroGames) * G,
  ];
  const base = train.map(d);
  const n = base[0].length;
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
  const probs = testSet.map((r) => sigmoid(enc(r).reduce((s, v, j) => s + v * w[j], 0)));
  const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;
  console.log(`  ${label.padEnd(34)} ${acc.toFixed(2)}%   (n=${testSet.length})`);
}

const test2025 = usable.filter((r) => r.start_time >= SPLIT);
const test2026 = usable.filter((r) => r.start_time >= Date.parse('2026-01-01') / 1000);

console.log('\n  === all held-out matches, 2025 onward ===');
run('pro matrix (what ships)', (r) => [r.proR - r.proD], test2025);
run('pub matrix instead', (r) => [r.pubR - r.pubD], test2025);
run('both together', (r) => [r.proR - r.proD, r.pubR - r.pubD], test2025);

console.log('\n  === 2026 only, where the pub matrix is contemporary ===');
run('pro matrix (what ships)', (r) => [r.proR - r.proD], test2026);
run('pub matrix instead', (r) => [r.pubR - r.pubD], test2026);
run('both together', (r) => [r.proR - r.proD, r.pubR - r.pubD], test2026);
