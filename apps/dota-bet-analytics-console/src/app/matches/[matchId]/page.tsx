import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Hint } from '@/components/Hint';
import { NetWorthChart } from '@/components/NetWorthChart';
import { Panel } from '@/components/Panel';
import { TeamRoster } from '@/components/TeamRoster';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** `900` -> `15m`. Under a minute keeps its unit, so a 10s league does not
    round to `0m` and read as no delay at all. */
function formatDelay(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId: raw } = await params;
  const matchId = Number(raw);
  if (!Number.isFinite(matchId)) {
    notFound();
  }

  const [prediction, series] = await Promise.all([api.prediction(matchId), api.series(matchId)]);

  return (
    <div>
      {/* Its own block above the stack, so the link is not read as part of the
          first panel. `inline-flex` keeps the hover target on the text. */}
      <Link
        href="/matches"
        className="mb-5 inline-flex items-center text-sm text-muted transition-colors hover:text-ink"
      >
        ← Matches
      </Link>

      <div className="space-y-6">
        <Panel title={`Net worth · match ${matchId}`}>
          {series && series.count > 0 ? (
            <NetWorthChart points={series.points} />
          ) : (
            <p className="text-sm text-muted">No snapshots stored for this match.</p>
          )}
        </Panel>

        {prediction ? (
          <>
            <Panel
              title="Prediction"
              action={
                prediction.leagueName ? (
                  <Link
                    href={`/predictions?league=${prediction.leagueId}`}
                    className="text-xs text-muted transition-colors hover:text-ink"
                    title="See every prediction from this tournament"
                  >
                    {prediction.leagueName.trim()}
                  </Link>
                ) : undefined
              }
            >
              <div className="mb-4 flex flex-wrap gap-6 text-sm max-sm:gap-x-4 max-sm:gap-y-2.5">
                <div>
                  <Hint
                    text="The side whose five players scored higher. This is the prediction."
                    className="text-faint"
                  >
                    Favoured
                  </Hint>{' '}
                  <span className="font-medium text-accent">
                    {prediction.favoured ?? 'neither'}
                  </span>
                </div>
                <div>
                  <Hint
                    text="How far apart the two team scores are, as a share of the higher one. This is the confidence — a wider gap is a stronger call."
                    className="text-faint"
                  >
                    Margin
                  </Hint>{' '}
                  <span className="mono">{prediction.marginPercent}%</span>
                </div>
                <div>
                  <Hint
                    text="Who actually won the match, once the result was published. Whether that made the prediction right is shown on the predictions list."
                    className="text-faint"
                  >
                    Result
                  </Hint>{' '}
                  {prediction.winner ? (
                    <span className="text-ink">{prediction.winner} won</span>
                  ) : (
                    <span className="text-muted">pending</span>
                  )}
                </div>
                {prediction.streamDelaySeconds !== undefined && (
                  <div>
                    <Hint
                      text="Valve serves this league's scoreboard on a delayed timeline, so the draft reached us this long after it was actually picked. The prediction is that far behind the real game from the moment it is made."
                      className="text-faint"
                    >
                      Delay
                    </Hint>{' '}
                    <span className="mono">{formatDelay(prediction.streamDelaySeconds)}</span>
                  </div>
                )}
                {!prediction.complete && (
                  <div className="text-warn">incomplete — some player stats were unavailable</div>
                )}
                {prediction.suspicious && (
                  <div className="text-warn">
                    <Hint text="Two or more players on a side have fewer than five games on the hero they picked. Usually that means a new account rather than a new player, and no public API links accounts back together. The prediction is still real arithmetic — it is just built on very little.">
                      thin records
                    </Hint>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TeamRoster
                  side="radiant"
                  teamName={prediction.radiantTeamName}
                  score={prediction.radiantScore}
                  players={prediction.radiantPlayers}
                  favoured={prediction.favoured === 'radiant'}
                />
                <TeamRoster
                  side="dire"
                  teamName={prediction.direTeamName}
                  score={prediction.direScore}
                  players={prediction.direPlayers}
                  favoured={prediction.favoured === 'dire'}
                />
              </div>
            </Panel>
          </>
        ) : (
          <Panel title="Prediction">
            <p className="text-sm text-muted">
              No prediction stored for this match. Matches discovered before their draft finished
              are scored on a later poll.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
