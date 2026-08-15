/**
 * Re-fetches the players whose stats failed to load, and re-scores the match.
 *
 * A prediction is stored even when OpenDota times out on a player, scored on
 * whoever did load. A blank player is not skipped — the mean is taken over all
 * five — so they enter as a 50% win rate and **zero games**, which drags the
 * side's `heroGames` down by twenty-odd points. One match reached seven blanks
 * out of ten, which is noise wearing a prediction's clothes.
 *
 * **This introduces a small bias, and it is the reason the app does not do
 * this automatically.** Win rates come from a career total that already
 * includes the match being scored, so a repaired player's record is nudged in
 * the direction of the result — roughly 0.7 of a percentage point against a
 * 150-game history, favouring whoever won. Live retries avoid this by only
 * running while the match is still going; this script cannot, so every row it
 * touches is stamped `repairedAt` and can be excluded from accuracy work.
 *
 * Only players that actually failed are re-fetched. The rest keep the numbers
 * they were scored on, so one repaired player does not silently restate the
 * whole draft.
 *
 *   infisical run --path=/dota-bet-analytics --env=prod -- \
 *     node apps/dota-bet-analytics/scripts/repair-incomplete.mjs --league "International 2026"
 *
 * `--dry` prints what would change and writes nothing.
 */
import mongoose from 'mongoose';

import { pick, scoreSide } from '../dist/predictions/scoring.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const leagueArg = args.includes('--league') ? args[args.indexOf('--league') + 1] : null;

const missing = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_NAME'].filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const { DB_USER, DB_PASSWORD, DB_HOST, DB_NAME, OPENDOTA_API_URL } = process.env;
const api = OPENDOTA_API_URL ?? 'https://api.opendota.com/api';
await mongoose.connect(
  `mongodb+srv://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority`,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The same 30s the app allows, because these endpoints reach 20 seconds. */
async function get(path) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      await sleep(1_000 * 2 ** attempt);
    }
    try {
      const response = await fetch(`${api}${path}`, { signal: AbortSignal.timeout(30_000) });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      /* fall through to the next attempt */
    }
  }
  return null;
}

const predictions = mongoose.connection.db.collection('predictions');
const filter = { complete: false };
if (leagueArg) {
  filter.leagueName = new RegExp(leagueArg);
}

const rows = await predictions.find(filter).toArray();
console.log(
  `${rows.length} incomplete predictions${leagueArg ? ` matching "${leagueArg}"` : ''}\n`,
);

const toStats = (p) => ({
  winRate: p.winRate,
  winsOnHero: p.winsOnHero ?? 0,
  gamesOnHero: p.gamesOnHero ?? 0,
});

let repaired = 0;
let flipped = 0;

for (const row of rows) {
  const sides = [row.radiantPlayers, row.direPlayers];
  let fetched = 0;
  let stillMissing = 0;

  for (const side of sides) {
    for (const player of side) {
      if (!player.missing) {
        continue;
      }
      /* An anonymous profile is real, not a failure. Nothing to re-fetch. */
      if (!player.accountId) {
        stillMissing += 1;
        continue;
      }

      const [heroes, profile] = await Promise.all([
        get(`/players/${player.accountId}/heroes`),
        get(`/players/${player.accountId}`),
      ]);
      await sleep(300);

      if (!Array.isArray(heroes)) {
        stillMissing += 1;
        continue;
      }

      const index = heroes.findIndex((h) => Number(h.hero_id) === player.heroId);
      const hero = index >= 0 ? heroes[index] : undefined;

      player.missing = false;
      player.personaName = profile?.profile?.personaname ?? player.personaName;
      player.leaderboardRank = profile?.leaderboard_rank ?? player.leaderboardRank;
      if (hero && hero.games > 0) {
        player.heroRank = index + 1;
        player.gamesOnHero = hero.games;
        player.winsOnHero = hero.win;
        player.winRate = Number(((hero.win / hero.games) * 100).toFixed(2));
      } else {
        player.heroRank = null;
        player.gamesOnHero = 0;
        player.winsOnHero = 0;
        player.winRate = null;
      }
      fetched += 1;
    }
  }

  if (fetched === 0) {
    console.log(`  ${row.matchId}  nothing recoverable`);
    continue;
  }

  const radiant = scoreSide(row.radiantPlayers.map(toStats), row.radiantMatchup ?? 50);
  const dire = scoreSide(row.direPlayers.map(toStats), row.direMatchup ?? 50);
  const outcome = pick(radiant, dire);

  /* Recovered from what was stored, so the result is never re-read from the
     match: `correct` said whether `favoured` matched the winner. */
  const radiantWon =
    row.winner === null || row.correct === null
      ? null
      : (row.favoured === 'radiant') === (row.correct === true);
  const correct = radiantWon === null ? null : (outcome.favoured === 'radiant') === radiantWon;

  const changed = outcome.favoured !== row.favoured;
  if (changed && row.correct !== null) {
    flipped += 1;
  }

  console.log(
    `  ${row.matchId}  ${fetched} recovered${stillMissing ? `, ${stillMissing} still missing` : ''}` +
      `  ${row.radiantScore}-${row.direScore} -> ${outcome.radiantScore}-${outcome.direScore}` +
      `  margin ${row.marginPercent}% -> ${outcome.marginPercent}%` +
      `  favoured ${row.favoured}${changed ? ` -> ${outcome.favoured}  (${row.correct === null ? 'pending' : row.correct ? 'right' : 'wrong'} -> ${correct === null ? 'pending' : correct ? 'right' : 'wrong'})` : ' unchanged'}`,
  );

  if (!dry) {
    await predictions.updateOne(
      { matchId: row.matchId },
      {
        $set: {
          radiantPlayers: row.radiantPlayers,
          direPlayers: row.direPlayers,
          radiantScore: outcome.radiantScore,
          direScore: outcome.direScore,
          favoured: outcome.favoured,
          margin: outcome.margin,
          marginPercent: outcome.marginPercent,
          correct,
          complete: stillMissing === 0,
          repairedAt: new Date(),
        },
      },
    );
  }
  repaired += 1;
}

console.log(
  `\n${dry ? 'would repair' : 'repaired'} ${repaired} predictions, ${flipped} changed which side they favour`,
);

await mongoose.disconnect();
