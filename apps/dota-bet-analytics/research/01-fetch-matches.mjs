/**
 * Step 1 — every tier 1–2 professional match since 2023, one row each.
 *
 * Fetched a month at a time so a failure costs one window rather than the run,
 * and so the whole thing can be resumed. Already-fetched months are skipped.
 *
 * The league name and tier are stored on every row on purpose: "only the big
 * events" then stays a slice we can take later, instead of a decision baked
 * into the fetch that would need a re-download to undo.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { monthWindows, politeDelay, query } from './opendota.mjs';

const FROM = '2023-01-01T00:00:00Z';
const OUT = new URL('./data/matches.jsonl', import.meta.url).pathname;

const done = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (line) {
      done.add(new Date(JSON.parse(line).start_time * 1000).toISOString().slice(0, 7));
    }
  }
}

const windows = monthWindows(FROM);
console.log(`${windows.length} months to cover, ${done.size} already present`);

let total = 0;
for (const { start, end, label } of windows) {
  if (done.has(label)) {
    console.log(`  ${label}  skipped (already fetched)`);
    continue;
  }

  const rows = await query(`
    SELECT m.match_id, m.start_time, m.duration, m.leagueid, m.radiant_win,
           m.radiant_team_id, m.dire_team_id, l.name AS league_name, l.tier
    FROM matches m
    JOIN leagues l ON l.leagueid = m.leagueid
    WHERE l.tier IN ('premium', 'professional')
      AND m.start_time >= ${start} AND m.start_time < ${end}
      AND m.radiant_win IS NOT NULL
  `);

  appendFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  total += rows.length;
  console.log(`  ${label}  ${rows.length} matches`);
  await politeDelay();
}

console.log(`\ndone — ${total} matches added, written to data/matches.jsonl`);
