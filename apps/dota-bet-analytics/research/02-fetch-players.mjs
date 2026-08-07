/**
 * Step 2 — the ten players of every match from step 1.
 *
 * `player_slot` carries the side: 0-127 is Radiant, 128+ is Dire. That is the
 * only place the side is recorded per player, and the whole point-in-time
 * history depends on it.
 *
 * Windows are half-months rather than months. A month of matches is ~20,000
 * player rows, close enough to where a response might be truncated that a
 * short window is worth the extra queries — and truncation here would be
 * silent, producing matches with six players and no error.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { monthWindows, politeDelay, query } from './opendota.mjs';

const FROM = '2023-01-01T00:00:00Z';
const OUT = new URL('./data/player-matches.jsonl', import.meta.url).pathname;
const MATCHES = new URL('./data/matches.jsonl', import.meta.url).pathname;

/** How many matches each window should have, so a short answer is visible. */
const expected = new Map();
for (const line of readFileSync(MATCHES, 'utf8').split('\n')) {
  if (!line) {
    continue;
  }
  const m = JSON.parse(line);
  const key = new Date(m.start_time * 1000).toISOString().slice(0, 10);
  expected.set(key, (expected.get(key) ?? 0) + 1);
}

const seen = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (line) {
      seen.add(JSON.parse(line).match_id);
    }
  }
}
console.log(`${expected.size} days of matches; ${seen.size} matches already have players`);

const halves = monthWindows(FROM).flatMap(({ start, end, label }) => {
  const mid = start + Math.floor((end - start) / 2);
  return [
    { start, end: mid, label: `${label}a` },
    { start: mid, end, label: `${label}b` },
  ];
});

let total = 0;
let short = 0;

for (const { start, end, label } of halves) {
  const matchesHere = [...expected.entries()]
    .filter(([day]) => {
      const t = Date.parse(`${day}T00:00:00Z`) / 1000;
      return t >= start - 86_400 && t < end + 86_400;
    })
    .reduce((n, [, count]) => n + count, 0);

  if (matchesHere === 0) {
    continue;
  }

  const rows = await query(`
    SELECT pm.match_id, pm.account_id, pm.hero_id, pm.player_slot
    FROM player_matches pm
    JOIN matches m ON m.match_id = pm.match_id
    JOIN leagues l ON l.leagueid = m.leagueid
    WHERE l.tier IN ('premium', 'professional')
      AND m.start_time >= ${start} AND m.start_time < ${end}
      AND m.radiant_win IS NOT NULL
  `);

  const fresh = rows.filter((r) => !seen.has(r.match_id));
  appendFileSync(OUT, fresh.map((r) => JSON.stringify(r)).join('\n') + (fresh.length ? '\n' : ''));
  total += fresh.length;

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
