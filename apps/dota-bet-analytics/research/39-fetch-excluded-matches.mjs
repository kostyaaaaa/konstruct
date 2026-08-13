/**
 * Step 1b — the same matches step 1 fetches, for the tier it left out.
 *
 * **Why this exists.** Step 1 takes `premium` and `professional`, which was
 * right when the app tracked leagues by tier. It no longer does: leagues are
 * chosen by prize money now, and most of what that admits — Mad Dogs, Ultras,
 * Asgard — OpenDota labels `excluded`. So the model was fitted on a population
 * the app has stopped watching, which is the leading explanation for it
 * scoring 60.5% in the backtest and 52.5% in production.
 *
 * 23,400 matches across 39 leagues, against the 81,846 already present.
 *
 * Appends to the same `matches.jsonl`, so everything downstream reads one
 * file. Resumable: the months already carrying an `excluded` row are skipped,
 * counted per tier so a rerun of step 1 and a rerun of this do not hide each
 * other.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { monthWindows, politeDelay, query } from './opendota.mjs';

const TIER = 'excluded';
const FROM = '2023-01-01T00:00:00Z';
const OUT = new URL('./data/matches.jsonl', import.meta.url).pathname;

const done = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) {
      continue;
    }
    const row = JSON.parse(line);
    if (row.tier === TIER) {
      done.add(new Date(row.start_time * 1000).toISOString().slice(0, 7));
    }
  }
}

const windows = monthWindows(FROM);
console.log(`${windows.length} months to cover, ${done.size} already have ${TIER} matches`);

let total = 0;
for (const { start, end, label } of windows) {
  if (done.has(label)) {
    console.log(`  ${label}  skipped`);
    continue;
  }

  const rows = await query(`
    SELECT m.match_id, m.start_time, m.duration, m.leagueid, m.radiant_win,
           m.radiant_team_id, m.dire_team_id, l.name AS league_name, l.tier
    FROM matches m
    JOIN leagues l ON l.leagueid = m.leagueid
    WHERE l.tier = '${TIER}'
      AND m.start_time >= ${start} AND m.start_time < ${end}
      AND m.radiant_win IS NOT NULL
  `);

  appendFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  total += rows.length;
  console.log(`  ${label}  ${rows.length} matches`);
  await politeDelay();
}

console.log(`\ndone — ${total} ${TIER} matches added to data/matches.jsonl`);
