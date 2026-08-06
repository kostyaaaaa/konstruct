import type { TeamRosterProps } from './types';

/**
 * One side's five players as they were when the prediction was made.
 *
 * This is the view the old app could only produce as an email — none of it was
 * stored, so a past prediction could not be rebuilt anywhere else.
 */
export function TeamRoster({ side, teamName, score, players, favoured }: TeamRosterProps) {
  const accent = side === 'radiant' ? 'text-radiant' : 'text-dire';

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className={`font-medium ${accent}`}>
          {teamName ?? (side === 'radiant' ? 'Radiant' : 'Dire')}
          {favoured && <span className="ml-2 text-xs text-faint">favoured</span>}
        </h3>
        <span className="font-mono text-lg tabular-nums">{score}</span>
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
              <div className="truncate text-sm">
                {player.heroName ?? `Hero ${player.heroId}`}
                {player.leaderboardRank && (
                  <span className="ml-2 text-xs text-warn">#{player.leaderboardRank}</span>
                )}
              </div>
              <div className="truncate text-xs text-faint">{player.personaName ?? 'anonymous'}</div>
            </div>

            <div className="text-right text-xs tabular-nums">
              {player.missing ? (
                <span className="text-warn">no data</span>
              ) : player.winRate === null ? (
                <span className="text-faint">never played</span>
              ) : (
                <>
                  <div className={player.winRate >= 50 ? 'text-ok' : 'text-muted'}>
                    {player.winRate}%
                  </div>
                  <div className="text-faint">
                    #{player.heroRank} · {player.gamesOnHero}g
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
