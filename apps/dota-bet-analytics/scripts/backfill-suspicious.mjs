/**
 * Sets `suspicious` on predictions written before the field existed.
 *
 * The value is fully derivable from data already stored — `gamesOnHero` is
 * kept for every player — so this recomputes rather than guesses, and running
 * it twice changes nothing.
 *
 * `isSuspicious` is imported from the build rather than copied, so the rule
 * cannot drift away from the one the app applies to new predictions. Build
 * first:
 *
 *   pnpm --filter dota-bet-analytics build
 *   infisical run --path=/dota-bet-analytics --env=prod -- \
 *     node apps/dota-bet-analytics/scripts/backfill-suspicious.mjs
 *
 * Pass `--dry` to see the counts without writing.
 */
import mongoose from 'mongoose';

import { isSuspicious } from '../dist/predictions/scoring.js';

const dry = process.argv.includes('--dry');

const { DB_USER, DB_PASSWORD, DB_HOST, DB_NAME } = process.env;
const missing = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_NAME'].filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

const uri = `mongodb+srv://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority`;
await mongoose.connect(uri);

const predictions = mongoose.connection.db.collection('predictions');
const rows = await predictions
  .find({}, { projection: { matchId: 1, radiantPlayers: 1, direPlayers: 1, suspicious: 1 } })
  .toArray();

let flagged = 0;
let changed = 0;

for (const row of rows) {
  const value = isSuspicious(row.radiantPlayers ?? [], row.direPlayers ?? []);
  if (value) {
    flagged += 1;
  }
  if (row.suspicious === value) {
    continue;
  }
  changed += 1;
  if (!dry) {
    await predictions.updateOne({ _id: row._id }, { $set: { suspicious: value } });
  }
}

console.log(
  `${DB_NAME}: ${rows.length} predictions, ${flagged} suspicious, ${changed} ${dry ? 'would change' : 'updated'}`,
);

await mongoose.disconnect();
