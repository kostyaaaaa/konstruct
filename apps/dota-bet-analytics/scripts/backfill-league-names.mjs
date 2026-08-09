/**
 * Fills `leagueName` on match registry rows written before discovery stored it.
 *
 * The field was declared on the schema from the start but never populated, so
 * every existing row has the id and no name. The names are already in the
 * `leagues` collection — this copies them across rather than fetching
 * anything, and running it twice changes nothing.
 *
 *   infisical run --path=/dota-bet-analytics --env=prod -- \
 *     node apps/dota-bet-analytics/scripts/backfill-league-names.mjs
 *
 * Pass `--dry` to see the counts without writing.
 */
import mongoose from 'mongoose';

const dry = process.argv.includes('--dry');

const missing = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_NAME'].filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const { DB_USER, DB_PASSWORD, DB_HOST, DB_NAME } = process.env;
await mongoose.connect(
  `mongodb+srv://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority`,
);

const matches = mongoose.connection.db.collection('live_matches');
const leagues = mongoose.connection.db.collection('leagues');

const ids = await matches.distinct('leagueId');
let updated = 0;
let unnamed = 0;

for (const leagueId of ids) {
  const league = await leagues.findOne({ leagueId }, { projection: { name: 1 } });
  /* `sync` writes the id as a placeholder for leagues OpenDota has not named.
     Left alone so the console falls back rather than printing a number. */
  const name = league?.name && league.name !== String(leagueId) ? league.name.trim() : null;

  if (!name) {
    unnamed += 1;
    continue;
  }

  const filter = { leagueId, leagueName: { $ne: name } };
  updated += dry
    ? await matches.countDocuments(filter)
    : (await matches.updateMany(filter, { $set: { leagueName: name } })).modifiedCount;
}

console.log(
  `${DB_NAME}: ${ids.length} leagues across the registry, ${unnamed} with no name, ${updated} rows ${dry ? 'would be' : ''} updated`,
);

await mongoose.disconnect();
