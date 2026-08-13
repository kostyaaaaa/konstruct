/**
 * Step 1c — what each league in the dataset paid out.
 *
 * **This is what makes the refit honest.** The app no longer picks leagues by
 * tier; it keeps any tournament whose Valve prize pool clears `MIN_PRIZE_POOL`.
 * Fitting on "tier 1-2" and running on "anything over $10,000" is the
 * population mismatch this whole rebuild is about, and the only way to close
 * it is to know what each historical league was worth.
 *
 * One call per league, not per match — about 600 of them. Written as its own
 * file so the fetch is done once and every later slice reads it.
 *
 *   infisical run --path=/dota-bet-analytics --env=prod -- \
 *     node research/41-fetch-prize-pools.mjs
 *
 * Needs `STEAM_API_KEY`. Resumable: leagues already in the file are skipped.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const KEY = process.env.STEAM_API_KEY;
if (!KEY) {
  throw new Error('Missing environment variable: STEAM_API_KEY');
}

const dir = new URL('./data/', import.meta.url).pathname;
const OUT = `${dir}prize-pools.jsonl`;

const leagues = new Map();
for (const line of readFileSync(`${dir}matches.jsonl`, 'utf8').split('\n')) {
  if (!line) {
    continue;
  }
  const row = JSON.parse(line);
  if (!leagues.has(row.leagueid)) {
    leagues.set(row.leagueid, { name: row.league_name, tier: row.tier, matches: 0 });
  }
  leagues.get(row.leagueid).matches += 1;
}

const done = new Set();
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (line) {
      done.add(JSON.parse(line).leagueId);
    }
  }
}

const todo = [...leagues.keys()].filter((id) => !done.has(id));
console.log(
  `${leagues.size} leagues in the dataset, ${done.size} already priced, ${todo.length} to fetch`,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fetched = 0;
for (const leagueId of todo) {
  const meta = leagues.get(leagueId);
  let prizePool = null;

  for (let attempt = 0; attempt < 3 && prizePool === null; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.steampowered.com/IEconDOTA2_570/GetTournamentPrizePool/v1/?key=${KEY}&leagueid=${leagueId}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!response.ok) {
        await sleep(1_000 * 2 ** attempt);
        continue;
      }
      const body = await response.json();
      prizePool = body.result?.prize_pool ?? 0;
    } catch {
      await sleep(1_000 * 2 ** attempt);
    }
  }

  /* Null rather than 0 when Valve never answered, so a failed lookup is not
     silently read later as a free tournament. */
  appendFileSync(
    OUT,
    JSON.stringify({
      leagueId,
      prizePool,
      name: meta.name,
      tier: meta.tier,
      matches: meta.matches,
    }) + '\n',
  );

  fetched += 1;
  if (fetched % 25 === 0) {
    console.log(`  ${fetched}/${todo.length}`);
  }
  await sleep(250);
}

console.log(`\ndone — ${fetched} leagues priced, written to data/prize-pools.jsonl`);
