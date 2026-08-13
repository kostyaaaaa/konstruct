/**
 * The refit, on the population the app actually watches.
 *
 * Same fitting code as `27-final-weights.mjs` — same params, same walk-forward
 * split, same flattening. **The only thing that changes is which matches are
 * in it.** The shipped weights were fitted on `premium` and `professional`
 * leagues, because that was how the app chose what to track. It now keeps any
 * tournament whose Valve prize pool clears `MIN_PRIZE_POOL`, which admits
 * 22,075 matches from the `excluded` tier and drops 21,000 from the other two.
 *
 * That mismatch is the leading explanation for 60.5% in the backtest against
 * 52.5% in production, and this is the experiment that tests it.
 *
 * Run each slice and compare like with like:
 *
 *   node research/42-refit-production-population.mjs           # >= $10k, the live rule
 *   node research/42-refit-production-population.mjs --tier12  # the old population
 *   node research/42-refit-production-population.mjs --min 50000
 *
 * **One gap this cannot close.** These win rates come from league matches
 * only, while production reads a player's whole career including pubs. There
 * is no fixing that historically — OpenDota serves today's career totals, and
 * using them on a 2023 match would leak the result of that very match. So the
 * backtest still measures a related param rather than the identical one.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const args = process.argv.slice(2);
const tier12Only = args.includes('--tier12');
const minPool = Number(args[args.indexOf('--min') + 1]) || 10_000;

const pools = new Map();
for (const line of readFileSync(`${dir}prize-pools.jsonl`, 'utf8').split('\n')) {
  if (line) {
    const row = JSON.parse(line);
    pools.set(row.leagueId, row.prizePool);
  }
}

const all = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const label = tier12Only
  ? 'tier 1-2 (the old population)'
  : `prize pool >= $${minPool.toLocaleString()}`;
const rows = all.filter((r) =>
  tier12Only
    ? r.tier === 'premium' || r.tier === 'professional'
    : (pools.get(r.league_id) ?? 0) >= minPool,
);

/* Everyone starts 2023 with an empty record, so the first six months are not
   evidence of anything. */
const usable = rows.filter((r) => r.start_time >= all[0].start_time + 182 * 24 * 3600);
const SPLIT = Date.parse('2025-01-01') / 1000;
const train = usable.filter((r) => r.start_time < SPLIT);
const test = usable.filter((r) => r.start_time >= SPLIT);

console.log(`${label}`);
console.log(`  ${rows.length} matches, ${train.length} train / ${test.length} held out\n`);

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const GAMES_SCALE = 17.1299;
const P = ['heroWinRate', 'heroMatchup', 'heroGames'];
const val = (s, p) =>
  p === 'heroGames'
    ? Math.log(1 + s.heroGames) * GAMES_SCALE
    : p === 'heroWinRate'
      ? s.heroWinRateShrunk
      : s[p];
const d = (row) => P.map((p) => val(row.radiant, p) - val(row.dire, p));

const base = train.map(d);
const mean = P.map((_, i) => base.reduce((s, x) => s + x[i], 0) / base.length);
const sd = P.map(
  (_, i) => Math.sqrt(base.reduce((s, x) => s + (x[i] - mean[i]) ** 2, 0) / base.length) || 1,
);
const enc = (row) => [...d(row).map((v, i) => (v - mean[i]) / sd[i]), 1];

const X = train.map(enc);
const y = train.map((r) => (r.radiant_win ? 1 : 0));
let w = new Array(4).fill(0);
for (let e = 0; e < 900; e += 1) {
  const g = new Array(4).fill(0);
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

const testY = test.map((r) => (r.radiant_win ? 1 : 0));
const probs = test.map((r) => sigmoid(enc(r).reduce((s, v, j) => s + v * w[j], 0)));
const acc = (100 * probs.filter((v, i) => v > 0.5 === Boolean(testY[i])).length) / probs.length;

const flat = P.map((_, i) => w[i] / sd[i]);
let constant = w[3];
P.forEach((_, i) => (constant -= (w[i] * mean[i]) / sd[i]));
const total = flat.reduce((s, v) => s + v, 0);

/* Baselines on the same held-out matches, so the accuracy has something to be
   better than. */
const radiantBase = (100 * testY.filter(Boolean).length) / testY.length;
const SHIPPED = { heroWinRate: 0.4977, heroMatchup: 0.3998, heroGames: 0.1026, bonus: 0.6781 };
const shippedRight = test.filter((r) => {
  const s = (side, isRadiant) =>
    SHIPPED.heroWinRate * side.heroWinRateShrunk +
    SHIPPED.heroMatchup * side.heroMatchup +
    SHIPPED.heroGames * Math.log(1 + side.heroGames) * GAMES_SCALE +
    (isRadiant ? SHIPPED.bonus : 0);
  return s(r.radiant, true) > s(r.dire, false) === Boolean(r.radiant_win);
}).length;

console.log(`  always Radiant   ${radiantBase.toFixed(2)}%`);
console.log(`  shipped weights  ${((100 * shippedRight) / test.length).toFixed(2)}%`);
console.log(`  refitted here    ${acc.toFixed(2)}%\n`);

/* Each param on its own, on the held-out set: does the higher side win? This
   is what production says is broken, so it is the number to compare. */
console.log('  each param alone, held out:');
for (const p of P) {
  const set = test.filter((r) => val(r.radiant, p) !== val(r.dire, p));
  const right = set.filter((r) => val(r.radiant, p) > val(r.dire, p) === Boolean(r.radiant_win));
  console.log(
    `    ${p.padEnd(12)} ${((100 * right.length) / set.length).toFixed(2)}%  (n=${set.length})`,
  );
}

console.log('\n  WEIGHTS = {');
P.forEach((p, i) => console.log(`    ${p}: ${(flat[i] / total).toFixed(4)},`));
console.log(`  }\n  RADIANT_BONUS = ${(constant / total).toFixed(4)}`);
