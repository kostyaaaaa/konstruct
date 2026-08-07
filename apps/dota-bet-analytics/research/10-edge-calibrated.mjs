/**
 * Step 8, but against an Elo price that is actually honest.
 *
 * Raw Elo is over-confident: it says 20% and underdogs win 27%. Measured
 * against that, anything picking underdogs shows a fake edge, which is what
 * made every param in step 8 look profitable.
 *
 * The fix is the divisor. Elo's `/400` sets how fast a rating gap turns into a
 * probability; too small a number makes the curve too steep. This finds the
 * divisor with the lowest log-loss — the standard score for probability
 * forecasts, which punishes confident mistakes — and prices against that.
 */
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const rows = readFileSync(`${dir}params.jsonl`, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const scored = rows.filter(
  (r) =>
    r.start_time >= rows[0].start_time + 182 * 24 * 3600 &&
    r.radiant.teamGames > 20 &&
    r.dire.teamGames > 20,
);

const prob = (mine, theirs, divisor) => 1 / (1 + 10 ** ((theirs - mine) / divisor));

let best = { divisor: 400, loss: Infinity };
for (let divisor = 300; divisor <= 900; divisor += 10) {
  let loss = 0;
  for (const row of scored) {
    const p = Math.min(
      0.999,
      Math.max(0.001, prob(row.radiant.teamElo, row.dire.teamElo, divisor)),
    );
    loss -= row.radiant_win ? Math.log(p) : Math.log(1 - p);
  }
  loss /= scored.length;
  if (loss < best.loss) {
    best = { divisor, loss };
  }
}

const raw =
  scored.reduce((sum, row) => {
    const p = Math.min(0.999, Math.max(0.001, prob(row.radiant.teamElo, row.dire.teamElo, 400)));
    return sum - (row.radiant_win ? Math.log(p) : Math.log(1 - p));
  }, 0) / scored.length;

console.log(
  `  best divisor: ${best.divisor} (log-loss ${best.loss.toFixed(4)}), was 400 (${raw.toFixed(4)})`,
);
console.log(`  lower is better; 0.693 is a coin flip\n`);

const PARAMS = Object.keys(scored[0].radiant).filter((k) => k !== 'known' && k !== 'teamFormGames');

console.log(
  'param'.padEnd(20) +
    'AGAINST favourite'.padStart(20) +
    'fair price'.padStart(12) +
    'edge'.padStart(9) +
    '±95%'.padStart(8),
);
console.log('-'.repeat(69));

const out = [];
for (const param of PARAMS) {
  let right = 0;
  let n = 0;
  let priced = 0;

  for (const row of scored) {
    const r = row.radiant[param];
    const d = row.dire[param];
    if (r === d) {
      continue;
    }
    const picksRadiant = r > d;
    if (picksRadiant === row.radiant.teamElo > row.dire.teamElo) {
      continue; // agrees with the favourite — the bookmaker prices this fine
    }
    n += 1;
    right += picksRadiant === row.radiant_win ? 1 : 0;
    priced += picksRadiant
      ? prob(row.radiant.teamElo, row.dire.teamElo, best.divisor)
      : prob(row.dire.teamElo, row.radiant.teamElo, best.divisor);
  }

  if (n < 500) {
    continue;
  }
  const acc = (100 * right) / n;
  const fair = (100 * priced) / n;
  const ci = 1.96 * Math.sqrt(0.25 / n) * 100;
  out.push({ param, acc, fair, edge: acc - fair, n, ci });
}

for (const r of out.sort((a, b) => b.edge - a.edge)) {
  console.log(
    r.param.padEnd(20) +
      `${r.acc.toFixed(1)}% (${r.n})`.padStart(20) +
      `${r.fair.toFixed(1)}%`.padStart(12) +
      `${r.edge >= 0 ? '+' : ''}${r.edge.toFixed(1)}`.padStart(9) +
      `${r.ci.toFixed(1)}`.padStart(8),
  );
}
console.log('\n  edge is in percentage points over a fair price. A bookmaker margin');
console.log('  of 5-8 points sits on top, so anything under ~+6 is not a bet.');
