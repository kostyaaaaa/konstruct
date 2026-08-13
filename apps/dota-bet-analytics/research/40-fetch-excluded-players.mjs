/**
 * Step 2b — the ten players of every match step 1b added.
 *
 * Mirrors step 2 exactly, for the one tier it does not select. Kept separate
 * rather than folded into step 2 because step 2 re-queries every window on
 * every run; widening its `WHERE` would mean re-fetching 818,470 rows that are
 * already on disk to collect 234,000 new ones.
 *
 * Appends to the same `player-matches.jsonl`. Resumable by `match_id`, so a
 * rerun costs query time and writes nothing.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { monthWindows, politeDelay, query } from './opendota.mjs';

const TIER = 'excluded';
const FROM = '2023-01-01T00:00:00Z';
const OUT = new URL('./data/player-matches.jsonl', import.meta.url).pathname;
const MATCHES = new URL('./data/matches.jsonl', import.meta.url).pathname;

/** Which half-months have matches of this tier, so empty windows are skipped. */
const wanted = new Set();
let expected = 0;
for (const line of readFileSync(MATCHES, 'utf8').split('\n')) {
  if (!line) {
    continue;
  }
  const row = JSON.parse(line);
  if (row.tier === TIER) {
    wanted.add(new Date(row.start_time * 1000).toISOString().slice(0, 7));
    expected += 1;
  }
}

const seen = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (line) {
      seen.add(JSON.parse(line).match_id);
    }
  }
}
console.log(
  `${expected} ${TIER} matches over ${wanted.size} months; ${seen.size} already have players`,
);

const halves = monthWindows(FROM)
  .filter(({ label }) => wanted.has(label))
  .flatMap(({ start, end, label }) => {
    const mid = start + Math.floor((end - start) / 2);
    return [
      { start, end: mid, label: `${label}a` },
      { start: mid, end, label: `${label}b` },
    ];
  });

let total = 0;
let short = 0;

for (const { start, end, label } of halves) {
  const rows = await query(`
    SELECT pm.match_id, pm.account_id, pm.hero_id, pm.player_slot
    FROM player_matches pm
    JOIN matches m ON m.match_id = pm.match_id
    JOIN leagues l ON l.leagueid = m.leagueid
    WHERE l.tier = '${TIER}'
      AND m.start_time >= ${start} AND m.start_time < ${end}
      AND m.radiant_win IS NOT NULL
  `);

  const fresh = rows.filter((r) => !seen.has(r.match_id));
  appendFileSync(OUT, fresh.map((r) => JSON.stringify(r)).join('\n') + (fresh.length ? '\n' : ''));
  for (const row of fresh) {
    seen.add(row.match_id);
  }
  total += fresh.length;

  /* A truncated response would silently produce matches with six players, so
     the rows-per-match ratio is checked rather than assumed. */
  const perMatch = rows.length / Math.max(new Set(rows.map((r) => r.match_id)).size, 1);
  const flag = perMatch < 9.5 ? '  ** short, check for truncation' : '';
  if (flag) {
    short += 1;
  }
  console.log(`  ${label}  ${rows.length} rows, ${perMatch.toFixed(1)}/match${flag}`);
  await politeDelay();
}

console.log(
  `\ndone — ${total} player rows written${short ? `, ${short} windows looked short` : ''}`,
);
