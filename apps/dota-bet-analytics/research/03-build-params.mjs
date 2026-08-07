/**
 * Step 3 — turn raw matches into one row of params per match.
 *
 * A **param** is one measurable quantity about a side, computed from what was
 * known *before* that match started. A **strategy** (step 4) is a named idea
 * plus a coefficient for each param.
 *
 * Everything here is computed by walking matches in time order and updating
 * history only *after* the row is written. That ordering is the whole point:
 * a player's win rate on a hero is what it was that day, not what it is now.
 */
import { createWriteStream } from 'node:fs';
import { readFileSync } from 'node:fs';

const dir = new URL('./data/', import.meta.url).pathname;

const matches = new Map();
for (const line of readFileSync(`${dir}matches.jsonl`, 'utf8').split('\n')) {
  if (line) {
    const m = JSON.parse(line);
    matches.set(m.match_id, m);
  }
}

const players = new Map();
for (const line of readFileSync(`${dir}player-matches.jsonl`, 'utf8').split('\n')) {
  if (line) {
    const r = JSON.parse(line);
    if (!players.has(r.match_id)) {
      players.set(r.match_id, []);
    }
    players.get(r.match_id).push(r);
  }
}

const ordered = [...matches.values()]
  .filter((m) => players.get(m.match_id)?.length === 10)
  .sort((a, b) => a.start_time - b.start_time);

console.log(`${ordered.length} matches in time order`);

/** Per player: games and wins overall, and per hero. */
const history = new Map();
/** Per team: Elo, plus games and wins. */
const teams = new Map();

/** Hero-vs-hero and hero-with-hero records, built forward in time. */
const matchups = new Map(); // "a:b" -> [games, wins for a]
const synergies = new Map(); // "a:b" (a<b) -> [games, wins]

/** Most hero pairs are rare, so a cell is pulled toward 50% by its own size. */
const PAIR_SHRINK = 0;

/**
 * How far back "recent" reaches, for the params that care about now rather
 * than ever. Ninety days is roughly a patch cycle plus a tournament.
 */
const RECENT_SECONDS = 90 * 24 * 3600;
/** Matches counted for a team's current form. */
const FORM_MATCHES = 20;

/** Recent results, kept as timestamped lists and trimmed when read. */
const heroRecent = new Map(); // heroId -> [{ t, won }]
const playerHeroRecent = new Map(); // "account:hero" -> [{ t, won }]
const teamForm = new Map(); // teamId -> [won, ...] most recent last

function trimmed(store, key, now) {
  const list = store.get(key);
  if (!list) {
    return [];
  }
  /* Entries are appended in time order, so everything expired sits at the
     front and one splice clears it. */
  let cut = 0;
  while (cut < list.length && list[cut].t < now - RECENT_SECONDS) {
    cut += 1;
  }
  if (cut > 0) {
    list.splice(0, cut);
  }
  return list;
}

function recentRate(store, key, now, shrink = 10) {
  const list = trimmed(store, key, now);
  const wins = list.reduce((n, e) => n + (e.won ? 1 : 0), 0);
  return { games: list.length, rate: ((wins + shrink * 0.5) / (list.length + shrink)) * 100 };
}

const pairKey = (a, b) => `${a}:${b}`;
const allyKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

function rate(store, key) {
  const [games, wins] = store.get(key) ?? [0, 0];
  return ((wins + PAIR_SHRINK * 0.5) / (games + PAIR_SHRINK)) * 100;
}

const ELO_START = 1500;
const ELO_K = 24;
/** Pulls a thin record toward an even 50%, so 2 games cannot read as 100%. */
const SHRINK = 10;

function playerState(id) {
  if (!history.has(id)) {
    history.set(id, { games: 0, wins: 0, heroes: new Map() });
  }
  return history.get(id);
}

function teamState(id) {
  if (!teams.has(id)) {
    teams.set(id, { elo: ELO_START, games: 0, wins: 0 });
  }
  return teams.get(id);
}

/**
 * How this side's heroes have historically fared against those five, and
 * alongside each other.
 *
 * `heroMatchup` is the mean win rate of each of our heroes against each of
 * theirs — 25 pairs, averaged per hero then summed. `heroSynergy` is the same
 * idea for our own 10 pairs.
 */
function draftParams(ourHeroes, theirHeroes) {
  let matchup = 0;
  for (const a of ourHeroes) {
    let total = 0;
    for (const b of theirHeroes) {
      total += rate(matchups, pairKey(a, b));
    }
    matchup += total / theirHeroes.length;
  }

  let synergy = 0;
  let pairs = 0;
  for (let i = 0; i < ourHeroes.length; i += 1) {
    for (let j = i + 1; j < ourHeroes.length; j += 1) {
      synergy += rate(synergies, allyKey(ourHeroes[i], ourHeroes[j]));
      pairs += 1;
    }
  }

  /* Per hero, not summed over five, so 50 reads as "even" rather than 250. */
  return {
    heroMatchup: matchup / ourHeroes.length,
    heroSynergy: pairs ? synergy / pairs : 50,
  };
}

/** Params for one side, from the five players as they were before this match. */
function sideParams(side, teamId, now) {
  const p = {
    heroWinRate: 0,
    heroWinRateShrunk: 0,
    heroGames: 0,
    heroRankScore: 0,
    playerGames: 0,
    playerWinRate: 0,
    known: 0,
    heroMeta: 0,
    heroGamesRecent: 0,
    heroWinRateRecent: 0,
  };

  for (const row of side) {
    const state = playerState(row.account_id);
    const hero = state.heroes.get(row.hero_id) ?? { games: 0, wins: 0 };

    if (hero.games > 0) {
      p.heroWinRate += (hero.wins / hero.games) * 100;
      p.known += 1;
    }
    p.heroWinRateShrunk += ((hero.wins + SHRINK * 0.5) / (hero.games + SHRINK)) * 100;
    p.heroGames += hero.games;

    /* Familiarity as the production formula defines it: where this hero sits
       in the player's most-played list, 1-based. Absent heroes contribute
       nothing rather than dividing by zero. */
    if (hero.games > 0) {
      let rank = 1;
      for (const [, other] of state.heroes) {
        if (other.games > hero.games) {
          rank += 1;
        }
      }
      p.heroRankScore += 100 / rank;
    }

    p.playerGames += state.games;
    p.playerWinRate += state.games > 0 ? (state.wins / state.games) * 100 : 50;

    /* How strong the hero itself is at the moment, separately from how good
       this player is on it. `heroWinRate` conflates the two. */
    p.heroMeta += recentRate(heroRecent, row.hero_id, now, 40).rate;

    /* Comfort that has not gone stale: an all-time count treats a hero last
       played two years ago as current. */
    const recent = recentRate(playerHeroRecent, `${row.account_id}:${row.hero_id}`, now);
    p.heroGamesRecent += recent.games;
    p.heroWinRateRecent += recent.rate;
  }

  /**
   * Everything above is a running total over the five players. Dividing by
   * five turns each into "per player", so a win rate reads 0-100 like a
   * percentage instead of 0-500. Nothing is lost — a sum and a mean of five
   * carry the same information — and the numbers stop needing a translation
   * every time they are read.
   */
  for (const key of [
    'heroWinRate',
    'heroWinRateShrunk',
    'heroWinRateRecent',
    'heroRankScore',
    'heroGames',
    'heroGamesRecent',
    'playerGames',
    'playerWinRate',
    'heroMeta',
  ]) {
    p[key] /= side.length;
  }

  const team = teamId ? teamState(teamId) : null;
  p.teamElo = team ? team.elo : ELO_START;
  p.teamGames = team ? team.games : 0;
  p.teamWinRate = team && team.games > 0 ? (team.wins / team.games) * 100 : 50;

  /* Elo moves slowly by design, so it is late to notice a slump or a roster
     change. A fixed window of recent matches reacts immediately. */
  const form = teamId ? (teamForm.get(teamId) ?? []) : [];
  const formWins = form.reduce((n, won) => n + (won ? 1 : 0), 0);
  p.teamFormRecent = ((formWins + 5) / (form.length + 10)) * 100;
  p.teamFormGames = form.length;

  return p;
}

const out = createWriteStream(`${dir}params.jsonl`);
let written = 0;

for (const m of ordered) {
  const rows = players.get(m.match_id);
  const radiant = rows.filter((r) => r.player_slot < 128);
  const dire = rows.filter((r) => r.player_slot >= 128);
  if (radiant.length !== 5 || dire.length !== 5) {
    continue;
  }

  const radiantHeroes = radiant.map((r) => r.hero_id);
  const direHeroes = dire.map((r) => r.hero_id);

  const record = {
    match_id: m.match_id,
    start_time: m.start_time,
    tier: m.tier,
    league_id: m.leagueid,
    league_name: m.league_name,
    radiant_win: m.radiant_win,
    radiant: {
      ...sideParams(radiant, m.radiant_team_id, m.start_time),
      ...draftParams(radiantHeroes, direHeroes),
    },
    dire: {
      ...sideParams(dire, m.dire_team_id, m.start_time),
      ...draftParams(direHeroes, radiantHeroes),
    },
  };
  out.write(`${JSON.stringify(record)}\n`);
  written += 1;

  // ---- only now does this match become history ----
  for (const row of rows) {
    const won = row.player_slot < 128 === m.radiant_win;

    if (!heroRecent.has(row.hero_id)) {
      heroRecent.set(row.hero_id, []);
    }
    heroRecent.get(row.hero_id).push({ t: m.start_time, won });

    const key = `${row.account_id}:${row.hero_id}`;
    if (!playerHeroRecent.has(key)) {
      playerHeroRecent.set(key, []);
    }
    playerHeroRecent.get(key).push({ t: m.start_time, won });
  }

  for (const row of rows) {
    const state = playerState(row.account_id);
    const won = row.player_slot < 128 === m.radiant_win;
    state.games += 1;
    state.wins += won ? 1 : 0;
    const hero = state.heroes.get(row.hero_id) ?? { games: 0, wins: 0 };
    hero.games += 1;
    hero.wins += won ? 1 : 0;
    state.heroes.set(row.hero_id, hero);
  }

  /* The draft matrices learn from this match only after it was predicted. */
  const winners = m.radiant_win ? radiantHeroes : direHeroes;
  const losers = m.radiant_win ? direHeroes : radiantHeroes;

  for (const w of winners) {
    for (const l of losers) {
      const up = matchups.get(pairKey(w, l)) ?? [0, 0];
      matchups.set(pairKey(w, l), [up[0] + 1, up[1] + 1]);
      const down = matchups.get(pairKey(l, w)) ?? [0, 0];
      matchups.set(pairKey(l, w), [down[0] + 1, down[1]]);
    }
  }

  for (const [heroes, won] of [
    [radiantHeroes, m.radiant_win],
    [direHeroes, !m.radiant_win],
  ]) {
    for (let i = 0; i < heroes.length; i += 1) {
      for (let j = i + 1; j < heroes.length; j += 1) {
        const key = allyKey(heroes[i], heroes[j]);
        const cur = synergies.get(key) ?? [0, 0];
        synergies.set(key, [cur[0] + 1, cur[1] + (won ? 1 : 0)]);
      }
    }
  }

  if (m.radiant_team_id && m.dire_team_id) {
    const r = teamState(m.radiant_team_id);
    const d = teamState(m.dire_team_id);
    const expected = 1 / (1 + 10 ** ((d.elo - r.elo) / 400));
    const actual = m.radiant_win ? 1 : 0;
    r.elo += ELO_K * (actual - expected);
    d.elo -= ELO_K * (actual - expected);
    r.games += 1;
    r.wins += m.radiant_win ? 1 : 0;
    d.games += 1;
    d.wins += m.radiant_win ? 0 : 1;

    for (const [id, won] of [
      [m.radiant_team_id, m.radiant_win],
      [m.dire_team_id, !m.radiant_win],
    ]) {
      const list = teamForm.get(id) ?? [];
      list.push(Boolean(won));
      if (list.length > FORM_MATCHES) {
        list.shift();
      }
      teamForm.set(id, list);
    }
  }
}

out.end();
console.log(`wrote ${written} param rows to data/params.jsonl`);
console.log(`players tracked: ${history.size}, teams tracked: ${teams.size}`);
console.log(`matchup cells: ${matchups.size}, synergy cells: ${synergies.size}`);

const counts = [...matchups.values()].map(([g]) => g).sort((a, b) => a - b);
const at = (q) => counts[Math.floor(counts.length * q)];
console.log(`matchup samples per cell — median ${at(0.5)}, 10th ${at(0.1)}, 90th ${at(0.9)}`);
