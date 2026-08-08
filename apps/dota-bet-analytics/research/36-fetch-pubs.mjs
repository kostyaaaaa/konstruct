/**
 * Divine+ public matches, for a second hero-matchup matrix.
 *
 * **The last month**, which is what production would have to hand.
 *
 * Note this is *after* most of the held-out test matches, so scoring the whole
 * 2025-onward period with it is mildly optimistic — the matrix knows about
 * patches that came later. The clean read is the 2026 subset, where the matrix
 * and the matches are contemporaries. Both are reported.
 *
 * Fetched an hour at a time: aggregate queries over this table exceed
 * OpenDota's timeout, but an hour of Divine+ is only ~2,300 rows.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { politeDelay, query } from './opendota.mjs';

const OUT = new URL('./data/pub-matches.jsonl', import.meta.url).pathname;

/* The last month. Recent data matches what production would actually have,
   and the current patch is the one that matters for a matchup. */
const TO = Math.floor(Date.now() / 1000) - 3600;
const FROM = TO - 30 * 24 * 3600;
/* Six-hour windows: a month of hours would be 720 queries, and Divine+ is
   sparse enough that six hours still fits comfortably in one response. */
const HOUR = 6 * 3600;
/** Divine and above. Below this the game is different enough to be noise. */
const MIN_RANK = 70;

const done = new Set();
if (existsSync(OUT)) {
  for (const l of readFileSync(OUT, 'utf8').split('\n')) {
    if (l) {
      done.add(JSON.parse(l).w);
    }
  }
}

console.log(`${(TO - FROM) / HOUR} hours to cover, ${done.size} already fetched`);
let total = 0;

for (let start = FROM; start < TO; start += HOUR) {
  if (done.has(start)) {
    continue;
  }

  const rows = await query(`
    SELECT radiant_win, radiant_team, dire_team
    FROM public_matches
    WHERE start_time >= ${start} AND start_time < ${start + HOUR}
      AND avg_rank_tier >= ${MIN_RANK}
      AND radiant_team IS NOT NULL AND dire_team IS NOT NULL
  `);

  const clean = rows.filter((r) => r.radiant_team?.length === 5 && r.dire_team?.length === 5);
  appendFileSync(OUT, `${JSON.stringify({ w: start, n: clean.length, m: clean })}\n`);
  total += clean.length;

  const step = Math.round((start - FROM) / HOUR) + 1;
  if (step % 10 === 0) {
    console.log(
      `  ${step}/${Math.round((TO - FROM) / HOUR)} windows, ${total.toLocaleString()} matches`,
    );
  }
  await politeDelay();
}

console.log(`done — ${total.toLocaleString()} Divine+ matches`);
