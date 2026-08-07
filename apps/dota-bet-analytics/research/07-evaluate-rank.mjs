/**
 * Does ladder rank predict anything, on the window where it is honest?
 *
 * Scored on the last 90 days only. `player-profiles.jsonl` holds today's
 * values, so on older matches it would be future information — see
 * `06-fetch-profiles.mjs`.
 *
 * Two encodings, because ~70% of pro players have no leaderboard rank at all
 * and a missing value is information rather than a gap:
 *
 * - `ladderScore` — how far up the ladder the ranked players are, 0-100
 * - `ladderCount` — how many of the five are on the leaderboard at all, 0-5
 */
import { readFileSync } from 'node:fs';

import { scoreSide, strategies } from './strategies.mjs';

const dir = new URL('./data/', import.meta.url).pathname;
const read = (f) =>
  readFileSync(`${dir}${f}`, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

const profiles = new Map(read('player-profiles.jsonl').map((p) => [p.account_id, p]));
const params = read('params.jsonl');

const rosters = new Map();
for (const r of read('player-matches.jsonl')) {
  if (!rosters.has(r.match_id)) {
    rosters.set(r.match_id, []);
  }
  rosters.get(r.match_id).push(r);
}

/** Ladder positions run past 5000, so treat that as the bottom of the scale. */
const LADDER_FLOOR = 5000;

function ladder(players) {
  let score = 0;
  let count = 0;
  for (const p of players) {
    const rank = profiles.get(p.account_id)?.leaderboard_rank;
    if (rank) {
      count += 1;
      score += (Math.max(0, LADDER_FLOOR - rank) / LADDER_FLOOR) * 100;
    }
  }
  return { ladderScore: score / players.length, ladderCount: count };
}

const latest = Math.max(...params.map((p) => p.start_time));
const window = params.filter(
  (p) => p.start_time >= latest - 90 * 24 * 3600 && rosters.has(p.match_id),
);

console.log(`${window.length} matches in the last 90 days, ${profiles.size} profiles known\n`);

const enriched = window.map((row) => {
  const rs = rosters.get(row.match_id);
  return {
    ...row,
    radiant: { ...row.radiant, ...ladder(rs.filter((r) => r.player_slot < 128)) },
    dire: { ...row.dire, ...ladder(rs.filter((r) => r.player_slot >= 128)) },
  };
});

const covered = enriched.filter((r) => r.radiant.ladderCount + r.dire.ladderCount > 0).length;
console.log(
  `matches with at least one ranked player: ${covered} (${((100 * covered) / enriched.length).toFixed(0)}%)\n`,
);

const candidates = [
  { name: 'ladder-score', idea: 'ladder position only', params: { ladderScore: 1 } },
  { name: 'ladder-count', idea: 'how many are on the leaderboard', params: { ladderCount: 1 } },
  ...strategies.filter((s) => ['team-strength', 'production', 'player-quality'].includes(s.name)),
  {
    name: 'team + ladder',
    idea: 'does ladder add anything on top of team strength?',
    params: { teamElo: 1, ladderScore: 2 },
  },
];

console.log('strategy'.padEnd(20) + ['≥0%', '≥5%', '≥10%'].map((m) => m.padStart(16)).join(''));
console.log('-'.repeat(68));

for (const s of candidates) {
  const cells = [0, 5, 10].map((threshold) => {
    let right = 0;
    let total = 0;
    for (const row of enriched) {
      const r = scoreSide(row.radiant, s.params, true);
      const d = scoreSide(row.dire, s.params, false);
      if (r === d) {
        continue;
      }
      const larger = Math.max(Math.abs(r), Math.abs(d));
      const margin = larger > 0 ? (Math.abs(r - d) / larger) * 100 : 0;
      if (margin < threshold) {
        continue;
      }
      total += 1;
      right += r > d === row.radiant_win ? 1 : 0;
    }
    const ci = total ? 1.96 * Math.sqrt(0.25 / total) * 100 : 0;
    return total < 50
      ? 'n/a'.padStart(16)
      : `${((100 * right) / total).toFixed(1)}±${ci.toFixed(1)} (${total})`.padStart(16);
  });
  console.log(s.name.padEnd(20) + cells.join(''));
}
