/** How closely the two versions of heroWinRate agree, pair by pair. */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const matches = new Map();
for (const l of readFileSync(`${dir}matches.jsonl`, 'utf8').split('\n')) {
  if (l) {
    const m = JSON.parse(l);
    matches.set(m.match_id, m);
  }
}
const pro = new Map();
for (const l of readFileSync(`${dir}player-matches.jsonl`, 'utf8').split('\n')) {
  if (!l) {
    continue;
  }
  const r = JSON.parse(l);
  const m = matches.get(r.match_id);
  if (!m) {
    continue;
  }
  const k = `${r.account_id}:${r.hero_id}`;
  const rec = pro.get(k) ?? [0, 0];
  pro.set(k, [rec[0] + 1, rec[1] + (r.player_slot < 128 === m.radiant_win ? 1 : 0)]);
}

const SHRINK = 10;
const shrunk = (w, g) => ((w + SHRINK * 0.5) / (g + SHRINK)) * 100;

const pairs = [];
for (const l of readFileSync(`${dir}career-heroes.jsonl`, 'utf8').split('\n')) {
  if (!l) {
    continue;
  }
  const { account_id, heroes } = JSON.parse(l);
  for (const h of heroes) {
    const rec = pro.get(`${account_id}:${h.h}`);
    if (!rec || rec[0] < 3 || h.g < 3) {
      continue;
    } // need both sides to say something
    pairs.push({
      proRate: shrunk(rec[1], rec[0]),
      careerRate: shrunk(h.w, h.g),
      proGames: rec[0],
      careerGames: h.g,
    });
  }
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const corr = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const va = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0));
  const vb = Math.sqrt(b.reduce((s, x) => s + (x - mb) ** 2, 0));
  return cov / (va * vb);
};

const P = pairs.map((p) => p.proRate);
const C = pairs.map((p) => p.careerRate);
console.log(
  `  ${pairs.length.toLocaleString()} player-hero pairs where both sources have 3+ games\n`,
);
console.log(`  pro-only  : mean ${mean(P).toFixed(1)}%`);
console.log(`  career    : mean ${mean(C).toFixed(1)}%`);
console.log(`  correlation: ${corr(P, C).toFixed(3)}`);

const diffs = pairs.map((p) => Math.abs(p.proRate - p.careerRate)).sort((a, b) => a - b);
console.log(`\n  absolute difference per pair:`);
console.log(`    median ${diffs[Math.floor(diffs.length / 2)].toFixed(1)} points`);
console.log(`    75th   ${diffs[Math.floor(diffs.length * 0.75)].toFixed(1)} points`);
console.log(`    90th   ${diffs[Math.floor(diffs.length * 0.9)].toFixed(1)} points`);

/* Does the disagreement shrink when we have more professional games? */
console.log('\n  by how many pro games we have:');
for (const [lo, hi] of [
  [3, 10],
  [10, 30],
  [30, 100],
  [100, 1e9],
]) {
  const sub = pairs.filter((p) => p.proGames >= lo && p.proGames < hi);
  if (sub.length < 30) {
    continue;
  }
  const c = corr(
    sub.map((p) => p.proRate),
    sub.map((p) => p.careerRate),
  );
  const d = sub.map((p) => Math.abs(p.proRate - p.careerRate)).sort((a, b) => a - b);
  console.log(
    `    ${String(lo).padStart(4)}-${hi > 1e8 ? '+  ' : String(hi).padEnd(3)}  ${String(sub.length).padStart(6)} pairs   corr ${c.toFixed(3)}   median gap ${d[Math.floor(d.length / 2)].toFixed(1)}`,
  );
}
