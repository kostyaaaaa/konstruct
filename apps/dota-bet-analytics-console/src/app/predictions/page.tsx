import Link from 'next/link';

import { Hint } from '@/components/Hint';
import { Panel } from '@/components/Panel';
import { Stat } from '@/components/Stat';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

const THRESHOLDS = [0, 5, 8, 10, 12, 15];

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
          <div className="flex flex-wrap gap-1">
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
                title="Share of settled predictions that named the side which went on to win."
                tone={
                  accuracy.accuracyPercent === null
                    ? 'neutral'
                    : accuracy.accuracyPercent >= 50
                      ? 'ok'
                      : 'bad'
                }
              />
              <Stat
                label="Settled"
                value={accuracy.settled}
                title="Predictions whose match has finished and whose player stats were complete. Everything else is excluded rather than counted as wrong."
              />
              <Stat
                label="Correct"
                value={accuracy.correct}
                title="Settled predictions where the favoured side won."
                tone="ok"
              />
              <Stat
                label="Wrong"
                value={accuracy.incorrect}
                title="Settled predictions where the other side won."
                tone="bad"
              />
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
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 py-3 transition-colors last:border-0 hover:bg-field max-sm:gap-3.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">
                      <span
                        className={
                          prediction.favoured === 'radiant'
                            ? 'font-medium text-accent'
                            : 'text-muted'
                        }
                        title={
                          prediction.favoured === 'radiant' ? 'Favoured — higher score' : undefined
                        }
                      >
                        {prediction.radiantTeamName ?? 'Radiant'}
                      </span>
                      <span className="px-2 text-faint">vs</span>
                      <span
                        className={
                          prediction.favoured === 'dire' ? 'font-medium text-accent' : 'text-muted'
                        }
                        title={
                          prediction.favoured === 'dire' ? 'Favoured — higher score' : undefined
                        }
                      >
                        {prediction.direTeamName ?? 'Dire'}
                      </span>
                    </div>
                    <div className="mt-0.5 mono text-xs text-faint">
                      <Hint text="Radiant score – Dire score. Each is the sum of that team's five players' win rates on their chosen heroes (weighted 80%) plus their familiarity with those heroes (weighted 20%). Higher is stronger, and the numbers only mean anything against each other.">
                        {prediction.radiantScore} – {prediction.direScore}
                      </Hint>{' '}
                      ·{' '}
                      <Hint text="How far apart the two scores are, as a share of the higher one. This is the confidence in the prediction — a bigger gap is a stronger call.">
                        {prediction.marginPercent}% margin
                      </Hint>
                      {!prediction.complete && <span className="text-warn"> · incomplete</span>}
                    </div>
                  </div>

                  <div className="text-right text-xs max-sm:ml-0 max-sm:text-left">
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
