import { Hint } from '@/components/Hint';

import type { TeamRosterProps } from './types';

/** `1` → `1st`, so the tooltip reads as a sentence. */
function ordinal(rank: number | null): string {
  if (rank === null) {
    return 'unranked';
  }
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${rank}th`;
  }
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] ?? 'th';
  return `${rank}${suffix}`;
}

/**
 * One side's five players as they were when the prediction was made.
 *
 * This is the view the old app could only produce as an email — none of it was
 * stored, so a past prediction could not be rebuilt anywhere else.
 *
 * **Favoured is marked in the accent, never in green.** Green and red already
 * mean Radiant and Dire here, and correct and wrong elsewhere. A third meaning
 * on the same two colours is what made "favoured in red, prediction correct"
 * read as a contradiction.
 */
export function TeamRoster({ side, teamName, score, players, favoured }: TeamRosterProps) {
  const accent = side === 'radiant' ? 'text-radiant' : 'text-dire';

  return (
    <div
      className={`rounded-lg border bg-card/60 p-4 ${favoured ? 'border-accent/40' : 'border-line'}`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className={`font-medium ${accent}`}>
          {teamName ?? (side === 'radiant' ? 'Radiant' : 'Dire')}
          {favoured && (
            <span
              className="ml-2 rounded-sm bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent"
              title="This side scored higher, so the prediction favours it. It does not say whether the prediction turned out right."
            >
              favoured
            </span>
          )}
        </h3>
        <Hint
          text="Team score: the five players' win rates on their chosen heroes added up and weighted 80%, plus 100 divided by each player's familiarity rank with their hero, weighted 20%. Higher is stronger. It only means anything next to the other team's score in this match."
          className={`mono text-lg ${favoured ? 'text-accent' : ''}`}
        >
          {score}
        </Hint>
      </header>

      <ul className="space-y-2">
        {players.map((player) => (
          <li key={`${player.accountId}-${player.heroId}`} className="flex items-center gap-3">
            {player.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.heroImageUrl}
                alt=""
                width={44}
                height={25}
                className="rounded-sm border border-line"
              />
            ) : (
              <div className="h-[25px] w-[44px] rounded-sm border border-line bg-field" />
            )}

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{player.heroName ?? `Hero ${player.heroId}`}</div>
              <div className="flex items-center gap-2 truncate text-xs text-faint">
                {/* The broadcast name where we have one. `personaName` is only
                    the Steam display name, which is rarely what a player is
                    called — and most tier 2 players are not in the pro list at
                    all, so the fallback is the normal case, not an error. */}
                {player.proName ? (
                  <Hint
                    text={`Competitive nickname. This account's Steam name is "${player.personaName ?? 'unknown'}".`}
                    className="text-muted"
                  >
                    {player.proName}
                  </Hint>
                ) : (
                  <span title="Steam display name. This player is not in OpenDota's professional list, so no competitive nickname is known.">
                    {player.personaName ?? 'anonymous'}
                  </span>
                )}
                {/* On the player's line, not the hero's — it describes the
                    person, and beside a hero name it reads as a hero stat. */}
                {player.leaderboardRank && (
                  <Hint
                    text={`This player sits at #${player.leaderboardRank} on the Dota 2 leaderboard. Lower is better, and only the very top players have a rank at all.`}
                    className="text-warn"
                  >
                    #{player.leaderboardRank}
                  </Hint>
                )}
              </div>
            </div>

            <div className="text-right text-xs tabular-nums">
              {player.missing ? (
                <span
                  className="text-warn"
                  title="This player's stats could not be fetched, so they added nothing to the team score. The prediction is marked incomplete."
                >
                  no data
                </span>
              ) : player.winRate === null ? (
                <span
                  className="text-faint"
                  title="This player has never picked this hero, so they added nothing to the team score."
                >
                  never played
                </span>
              ) : (
                <>
                  <Hint
                    text={`This player wins ${player.winRate}% of their recorded games on this hero.`}
                    className={player.winRate >= 50 ? 'text-ok' : 'text-muted'}
                  >
                    {player.winRate}%
                  </Hint>
                  <div className="text-faint">
                    <Hint
                      text={`Familiarity: this is their ${ordinal(player.heroRank)} most-played hero, with ${player.gamesOnHero} games on it. A lower number is a hero they know well, and it is worth a fifth of the team score.`}
                    >
                      #{player.heroRank} · {player.gamesOnHero}g
                    </Hint>
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
