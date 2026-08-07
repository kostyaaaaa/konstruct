/**
 * One strategy per param, split by whether it agrees with team strength.
 *
 * A bookmaker prices close to team strength, so a pick that agrees with Elo
 * pays little even when it is right. The pick that pays is the one that is
 * right *against* the favourite.
 *
 * Elo also gives an implied probability for any pairing:
 *
 *     implied = 1 / (1 + 10^((otherElo − pickElo) / 400))
 *
 * That is a stand-in for the price until real odds are available. If a param
 * picks underdogs and is right more often than `implied` says it should be,
 * it knows something team strength does not — and that difference is the edge.
 * Anything at or below zero is a bet that loses money slowly.
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

const PARAMS = Object.keys(scored[0].radiant).filter((k) => k !== 'known' && k !== 'teamFormGames');

const implied = (mine, theirs) => 1 / (1 + 10 ** ((theirs - mine) / 400));

console.log(`${scored.length} matches, both teams with 20+ games\n`);
console.log(
  'param'.padEnd(20) +
    'all picks'.padStart(15) +
    'agrees w/ Elo'.padStart(16) +
    'AGAINST Elo'.padStart(16) +
    'implied'.padStart(10) +
    'edge'.padStart(9),
);
console.log('-'.repeat(86));

const results = [];

for (const param of PARAMS) {
  const all = { right: 0, n: 0 };
  const withElo = { right: 0, n: 0 };
  const against = { right: 0, n: 0, impliedSum: 0 };

  for (const row of scored) {
    const r = row.radiant[param];
    const d = row.dire[param];
    if (r === d) {
      continue;
    }

    const picksRadiant = r > d;
    const correct = picksRadiant === row.radiant_win;
    const eloFavoursRadiant = row.radiant.teamElo > row.dire.teamElo;

    all.n += 1;
    all.right += correct ? 1 : 0;

    const bucket = picksRadiant === eloFavoursRadiant ? withElo : against;
    bucket.n += 1;
    bucket.right += correct ? 1 : 0;
    if (bucket === against) {
      against.impliedSum += picksRadiant
        ? implied(row.radiant.teamElo, row.dire.teamElo)
        : implied(row.dire.teamElo, row.radiant.teamElo);
    }
  }

  const pct = (b) => (b.n ? (100 * b.right) / b.n : 0);
  const impliedPct = against.n ? (100 * against.impliedSum) / against.n : 0;
  const edge = pct(against) - impliedPct;
  results.push({ param, edge, n: against.n, acc: pct(against) });

  const cell = (b) =>
    b.n < 100 ? 'n/a'.padStart(16) : `${pct(b).toFixed(1)}% (${b.n})`.padStart(16);
  console.log(
    param.padEnd(20) +
      `${pct(all).toFixed(1)}%`.padStart(15) +
      cell(withElo) +
      cell(against) +
      `${impliedPct.toFixed(1)}%`.padStart(10) +
      `${edge >= 0 ? '+' : ''}${edge.toFixed(1)}`.padStart(9),
  );
}

console.log('\n  Ranked by edge over the Elo-implied price, underdog picks only:');
for (const r of results
  .filter((r) => r.n >= 100)
  .sort((a, b) => b.edge - a.edge)
  .slice(0, 6)) {
  const ci = 1.96 * Math.sqrt(0.25 / r.n) * 100;
  console.log(
    `    ${r.param.padEnd(20)} edge ${r.edge >= 0 ? '+' : ''}${r.edge.toFixed(1)} points` +
      `   (${r.acc.toFixed(1)}% on ${r.n} picks, ±${ci.toFixed(1)})`,
  );
}
