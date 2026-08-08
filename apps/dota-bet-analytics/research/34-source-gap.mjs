/**
 * Do the two versions of `heroWinRate` agree?
 *
 * Production reads OpenDota's `/players/{id}/heroes` — a player's whole career
 * including pubs. The backtest read only professional matches since 2023. Same
 * idea, different populations, and the whole 60.5% estimate rests on them being
 * close enough.
 *
 * This compares them directly on the same player-hero pairs.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;
const OUT = `${dir}career-heroes.jsonl`;

/* Our side: every player-hero pair across the whole dataset. */
const matches = new Map();
for (const l of readFileSync(`${dir}matches.jsonl`, 'utf8').split('\n')) {
  if (l) {
    const m = JSON.parse(l);
    matches.set(m.match_id, m);
  }
}
const pro = new Map(); // "account:hero" -> [games, wins]
const recent = new Set();
const latest = Math.max(...[...matches.values()].map((m) => m.start_time));

for (const l of readFileSync(`${dir}player-matches.jsonl`, 'utf8').split('\n')) {
  if (!l) {
    continue;
  }
  const r = JSON.parse(l);
  const m = matches.get(r.match_id);
  if (!m) {
    continue;
  }
  const key = `${r.account_id}:${r.hero_id}`;
  const rec = pro.get(key) ?? [0, 0];
  pro.set(key, [rec[0] + 1, rec[1] + (r.player_slot < 128 === m.radiant_win ? 1 : 0)]);
  if (m.start_time >= latest - 90 * 24 * 3600 && r.account_id) {
    recent.add(r.account_id);
  }
}

const done = new Set();
if (existsSync(OUT)) {
  for (const l of readFileSync(OUT, 'utf8').split('\n')) {
    if (l) {
      done.add(JSON.parse(l).account_id);
    }
  }
}

/* A sample is enough for a correlation, and 400 costs eight minutes not thirty. */
const todo = [...recent].filter((id) => !done.has(id)).slice(0, 400);
console.log(
  `${recent.size} players active recently; fetching ${todo.length}, ${done.size} already have`,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
for (const [i, id] of todo.entries()) {
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${id}/heroes`, {
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      throw new Error(String(res.status));
    }
    const rows = await res.json();
    appendFileSync(
      OUT,
      `${JSON.stringify({ account_id: id, heroes: rows.map((h) => ({ h: Number(h.hero_id), g: h.games, w: h.win })) })}\n`,
    );
    ok += 1;
  } catch {
    /* A missing player is a gap in the sample, not a failure of the run. */
  }
  if ((i + 1) % 100 === 0) {
    console.log(`  ${i + 1}/${todo.length}  fetched ${ok}`);
  }
  await sleep(1_100);
}
console.log(`done — ${ok} players fetched`);
