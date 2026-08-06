import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Hint } from '@/components/Hint';
import { NetWorthChart } from '@/components/NetWorthChart';
import { Panel } from '@/components/Panel';
import { TeamRoster } from '@/components/TeamRoster';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

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
            <Panel title="Prediction">
              <div className="mb-4 flex flex-wrap gap-6 text-sm">
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
                {!prediction.complete && (
                  <div className="text-warn">incomplete — some player stats were unavailable</div>
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
