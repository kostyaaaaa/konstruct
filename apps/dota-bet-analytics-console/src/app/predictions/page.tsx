import Link from 'next/link';

import { Panel } from '@/components/Panel';
import { Stat } from '@/components/Stat';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

const THRESHOLDS = [0, 5, 10, 20, 30];

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ margin?: string }>;
}) {
  const { margin } = await searchParams;
  const threshold = Number(margin ?? 0) || 0;

  const [accuracy, list] = await Promise.all([api.accuracy(threshold), api.predictions()]);

  return (
    <div className="space-y-6">
      <Panel
        title="Accuracy"
        action={
          <div className="flex gap-1">
            {THRESHOLDS.map((value) => (
              <Link
                key={value}
                href={value === 0 ? '/predictions' : `/predictions?margin=${value}`}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  value === threshold
                    ? 'bg-field text-ink'
                    : 'text-faint hover:bg-surface hover:text-muted'
                }`}
              >
                ≥{value}%
              </Link>
            ))}
          </div>
        }
      >
        {accuracy ? (
          <>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat
                label="Accuracy"
                value={accuracy.accuracyPercent === null ? '—' : `${accuracy.accuracyPercent}%`}
                tone={
                  accuracy.accuracyPercent === null
                    ? 'neutral'
                    : accuracy.accuracyPercent >= 50
                      ? 'ok'
                      : 'bad'
                }
              />
              <Stat label="Settled" value={accuracy.settled} />
              <Stat label="Correct" value={accuracy.correct} tone="ok" />
              <Stat label="Wrong" value={accuracy.incorrect} tone="bad" />
            </div>
            <p className="mt-4 text-xs text-faint">
              Counts only predictions whose match has finished and whose player stats were complete.
              The margin filter is the confidence threshold — raising it keeps only the predictions
              where the two scores were furthest apart.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Accuracy unavailable.</p>
        )}
      </Panel>

      <Panel title={`Predictions (${list?.count ?? 0})`}>
        {list && list.count > 0 ? (
          <ul>
            {list.predictions.map((prediction) => (
              <li key={prediction.matchId}>
                <Link
                  href={`/matches/${prediction.matchId}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 py-3 transition-colors last:border-0 hover:bg-field"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">
                      <span
                        className={
                          prediction.favoured === 'radiant' ? 'text-radiant' : 'text-muted'
                        }
                      >
                        {prediction.radiantTeamName ?? 'Radiant'}
                      </span>
                      <span className="px-2 text-faint">vs</span>
                      <span className={prediction.favoured === 'dire' ? 'text-dire' : 'text-muted'}>
                        {prediction.direTeamName ?? 'Dire'}
                      </span>
                    </div>
                    <div className="mt-0.5 mono text-xs text-faint">
                      {prediction.radiantScore} – {prediction.direScore} ·{' '}
                      {prediction.marginPercent}% margin
                      {!prediction.complete && <span className="text-warn"> · incomplete</span>}
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    {prediction.winner ? (
                      <span className={prediction.correct ? 'text-ok' : 'text-bad'}>
                        {prediction.correct ? 'correct' : 'wrong'}
                      </span>
                    ) : (
                      <span className="text-faint">pending</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No predictions yet. One is made per tier 1–2 match once its draft is complete.
          </p>
        )}
      </Panel>
    </div>
  );
}
