/**
 * The shipping model, scored separately for each league tier.
 *
 * `premium` collapsed after the DPC ended in 2023, so the held-out period has
 * very few of them — the counts matter as much as the percentages here.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const W = { heroWinRate: 0.4977, heroMatchup: 0.3998, heroGames: 0.1026 };
const BONUS = 0.6781;
const G = 17.1299;
const score = (s, isRadiant) =>
  W.heroWinRate * s.heroWinRateShrunk +
  W.heroMatchup * s.heroMatchup +
  W.heroGames * Math.log(1 + s.heroGames) * G +
  (isRadiant ? BONUS : 0);

function measure(list, threshold) {
  let n = 0;
  let right = 0;
  for (const r of list) {
    const a = score(r.radiant, true);
    const b = score(r.dire, false);
    if (a === b) {
      continue;
    }
    if ((Math.abs(a - b) / Math.max(a, b)) * 100 < threshold) {
      continue;
    }
    n += 1;
    right += a > b === r.radiant_win ? 1 : 0;
  }
  const pct = n ? (100 * right) / n : 0;
  const ci = n ? 1.96 * Math.sqrt(0.25 / n) * 100 : 0;
  return { n, pct, ci };
}

function table(label, list) {
  console.log(`\n  ${label} — ${list.length.toLocaleString()} matches`);
  console.log('    margin   matches   win rate      ±95%');
  for (const t of [0, 5, 10, 15]) {
    const r = measure(list, t);
    if (r.n < 30) {
      console.log(`    >${String(t).padEnd(3)}%  ${String(r.n).padStart(8)}   too few`);
      continue;
    }
    console.log(
      `    >${String(t).padEnd(3)}%  ${String(r.n).padStart(8)}    ${r.pct.toFixed(2)}%     ±${r.ci.toFixed(2)}`,
    );
  }
}

const held = rows.filter((r) => r.start_time >= Date.parse('2025-01-01') / 1000);
const warm = rows[0].start_time + 182 * 24 * 3600;
const all = rows.filter((r) => r.start_time >= warm);

console.log('  === HELD OUT (2025 onward) ===');
table(
  'premium',
  held.filter((r) => r.tier === 'premium'),
);
table(
  'professional',
  held.filter((r) => r.tier === 'professional'),
);

console.log('\n\n  === EVERYTHING after warm-up (bigger premium sample) ===');
table(
  'premium',
  all.filter((r) => r.tier === 'premium'),
);
table(
  'professional',
  all.filter((r) => r.tier === 'professional'),
);

/* Tier is OpenDota's label; tournament size is a fact. Worth seeing both. */
const perLeague = new Map();
for (const r of all) {
  perLeague.set(r.league_id, (perLeague.get(r.league_id) ?? 0) + 1);
}
console.log('\n\n  === by how big the tournament is ===');
table(
  'big events (200+ matches)',
  all.filter((r) => perLeague.get(r.league_id) >= 200),
);
table(
  'mid (50-199)',
  all.filter((r) => perLeague.get(r.league_id) >= 50 && perLeague.get(r.league_id) < 200),
);
table(
  'small (under 50)',
  all.filter((r) => perLeague.get(r.league_id) < 50),
);
