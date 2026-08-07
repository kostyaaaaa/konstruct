/**
 * A **strategy** is an idea about what wins Dota matches, expressed as a
 * coefficient for each param.
 *
 * Score for a side = Σ (coefficient × param). The higher score is the pick,
 * and the gap between the two is the confidence — the same shape the
 * production formula already has, so a winner here can replace it directly.
 *
 * Params are summed over the five players, so they are on very different
 * scales: `heroWinRate` runs to ~500, `teamElo` sits near 1500. Coefficients
 * carry that difference; they are not comparable between params.
 */

export const strategies = [
  {
    name: 'production',
    idea: 'What the app ships today: hero win rate, weighted against how well the player knows the hero.',
    params: { heroWinRate: 0.8, heroRankScore: 0.2 },
  },
  {
    name: 'always-radiant',
    idea: 'The map is not symmetric. A control that ignores everything about the teams.',
    params: { side: 1 },
  },
  {
    name: 'team-strength',
    idea: 'Pro teams are not equal. Nothing but who has beaten whom.',
    params: { teamElo: 1 },
  },
  {
    name: 'hero-comfort',
    idea: 'Psychology: a player on a hero they know is confident and makes fewer mistakes.',
    params: { heroRankScore: 1, heroGames: 0.02 },
  },
  {
    name: 'hero-winrate-shrunk',
    idea: 'Hero win rate, but a 100% record over two games is not evidence.',
    params: { heroWinRateShrunk: 1 },
  },
  {
    name: 'hero-matchup',
    idea: 'The draft: how our five heroes have historically fared against their five.',
    params: { heroMatchup: 1 },
  },
  {
    name: 'hero-synergy',
    idea: 'The draft: how well our five heroes have worked together.',
    params: { heroSynergy: 1 },
  },
  {
    name: 'draft-only',
    idea: 'Both draft params, nothing about the people playing.',
    params: { heroMatchup: 1, heroSynergy: 1 },
  },
  {
    name: 'player-quality',
    idea: 'General skill: how these players do overall, regardless of hero.',
    params: { playerWinRate: 1, playerGames: 0.001 },
  },
  {
    name: 'team-plus-side',
    idea: 'Team strength, plus the free edge from which side of the map you are on.',
    params: { teamElo: 1, side: 12 },
  },
  {
    name: 'team-plus-comfort',
    idea: 'Team strength first, hero comfort as the tie-breaker between close teams.',
    params: { teamElo: 1, side: 12, heroRankScore: 0.15, heroWinRateShrunk: 0.1 },
  },
  {
    name: 'everything',
    idea: 'All of it at once, to see whether the extra params earn their place.',
    params: {
      teamElo: 1,
      side: 12,
      heroWinRateShrunk: 0.1,
      heroRankScore: 0.1,
      heroGames: 0.01,
      playerWinRate: 0.05,
    },
  },
];

/** `side` is a constant that only Radiant gets, so it has to be injected. */
export function scoreSide(params, coefficients, isRadiant) {
  let total = 0;
  for (const [param, coefficient] of Object.entries(coefficients)) {
    const value = param === 'side' ? (isRadiant ? 1 : 0) : (params[param] ?? 0);
    total += coefficient * value;
  }
  return total;
}
