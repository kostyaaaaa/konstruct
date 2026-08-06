import Link from 'next/link';
import { notFound } from 'next/navigation';

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
  if (!Number.isFinite(matchId)) notFound();

  const [prediction, series] = await Promise.all([api.prediction(matchId), api.series(matchId)]);

  return (
    <div className="space-y-6">
      <Link href="/matches" className="text-sm text-muted hover:text-ink">
        ← Matches
      </Link>

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
                <span className="text-faint">Favoured</span>{' '}
                <span className={prediction.favoured === 'radiant' ? 'text-radiant' : 'text-dire'}>
                  {prediction.favoured ?? 'neither'}
                </span>
              </div>
              <div>
                <span className="text-faint">Margin</span> {prediction.marginPercent}%
              </div>
              <div>
                <span className="text-faint">Result</span>{' '}
                {prediction.winner ? (
                  <span className={prediction.correct ? 'text-ok' : 'text-bad'}>
                    {prediction.winner} won — {prediction.correct ? 'correct' : 'wrong'}
                  </span>
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
            No prediction stored for this match. Matches discovered before their draft finished are
            scored on a later poll.
          </p>
        </Panel>
      )}
    </div>
  );
}
