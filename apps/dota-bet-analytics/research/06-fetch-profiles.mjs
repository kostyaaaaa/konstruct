/**
 * Current leaderboard rank and rank tier for players active recently.
 *
 * **These are today's values, not historical ones.** OpenDota keeps no history
 * of either, so a rank fetched now is only honest for a match played recently.
 * That is why only the last 90 days of players are fetched, and why anything
 * built on this must be scored on that window alone — applied to a 2023 match
 * it would be the model reading the future.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const OUT = `${dir}player-profiles.jsonl`;

const wanted = JSON.parse(readFileSync(`${dir}recent-players.json`, 'utf8'));

const done = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (line) {
      done.add(JSON.parse(line).account_id);
    }
  }
}

const todo = wanted.filter((id) => !done.has(id));
console.log(`${wanted.length} players, ${done.size} already fetched, ${todo.length} to go`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
let failed = 0;

for (const [index, id] of todo.entries()) {
  try {
    const response = await fetch(`https://api.opendota.com/api/players/${id}`, {
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const d = await response.json();
    appendFileSync(
      OUT,
      `${JSON.stringify({
        account_id: id,
        leaderboard_rank: d.leaderboard_rank ?? null,
        rank_tier: d.rank_tier ?? null,
        fetched_at: Math.floor(Date.now() / 1000),
      })}\n`,
    );
    ok += 1;
  } catch {
    failed += 1;
  }

  if ((index + 1) % 100 === 0) {
    console.log(`  ${index + 1}/${todo.length}  ok=${ok} failed=${failed}`);
  }
  await sleep(1_100);
}

console.log(`done — ${ok} fetched, ${failed} failed`);
