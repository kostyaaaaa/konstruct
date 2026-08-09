import Link from 'next/link';

import { Hint } from '@/components/Hint';
import { Panel } from '@/components/Panel';
import { Stat } from '@/components/Stat';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

const THRESHOLDS = [0, 5, 8, 10, 12, 15];

/**
 * Builds a link that changes one filter and keeps the other.
 *
 * The two filters answer different halves of the same question — how
 * confident, and where — so switching tournament must not silently reset the
 * margin back to zero.
 */
function filterHref(
  current: { margin: number; league?: number; includeSuspicious: boolean },
  next: Partial<typeof current>,
) {
  const merged = { ...current, ...next };
  const params = new URLSearchParams();
  if (merged.margin) {
    params.set('margin', String(merged.margin));
  }
  if (merged.league) {
    params.set('league', String(merged.league));
  }
  /* Only the non-default state reaches the URL, so the plain `/predictions`
     link is the trustworthy view rather than a bare one. */
  if (merged.includeSuspicious) {
    params.set('suspicious', '1');
  }
  const query = params.toString();
  return query ? `/predictions?${query}` : '/predictions';
}

const pill = (active: boolean) =>
  `rounded-md px-2.5 py-1 text-xs transition-colors ${
    active ? 'bg-field text-ink' : 'text-faint hover:bg-surface hover:text-muted'
  }`;

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ margin?: string; league?: string; suspicious?: string }>;
}) {
  const { margin, league, suspicious } = await searchParams;
  const threshold = Number(margin ?? 0) || 0;
  const leagueId = Number(league) || undefined;
  /* Excluded unless asked for. A thin-record match is still a real prediction,
     but it is not one to judge the model on. */
  const includeSuspicious = suspicious === '1';
  const current = { margin: threshold, league: leagueId, includeSuspicious };

  const [accuracy, list, leagues] = await Promise.all([
    api.accuracy(threshold, leagueId, includeSuspicious),
    api.predictions(leagueId, includeSuspicious, threshold),
    api.predictionLeagues(includeSuspicious),
  ]);

  const selected = leagues?.leagues.find((row) => row.leagueId === leagueId);

  return (
    <div className="space-y-6">
      <Panel
        title="Accuracy"
        action={
          <div className="flex flex-wrap gap-1">
            {THRESHOLDS.map((value) => (
              <Link
                key={value}
                href={filterHref(current, { margin: value })}
                className={pill(value === threshold)}
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

            {leagues && leagues.count > 0 && (
              <div className="mt-5 border-t border-line/60 pt-4">
                <div className="mb-2 text-xs text-faint">
                  <Hint text="Narrows both the figures above and the list below to one tournament. Pooled accuracy hides the difference between an event the model reads well and one it does not — and only some of these are events a bookmaker will even take a bet on.">
                    Tournament
                  </Hint>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Link
                    href={filterHref(current, { league: undefined })}
                    className={pill(!leagueId)}
                  >
                    All
                  </Link>
                  {leagues.leagues.map((row) => (
                    <Link
                      key={row.leagueId}
                      href={filterHref(current, { league: row.leagueId })}
                      className={`${pill(row.leagueId === leagueId)} flex items-center gap-1.5`}
                      title={`${row.count} predictions · ${row.settled} settled`}
                    >
                      <span className="max-w-48 truncate">
                        {row.leagueName ?? `League ${row.leagueId}`}
                      </span>
                      {row.settled > 0 && (
                        <span className="mono text-[10px] text-faint">
                          {row.correct}/{row.settled}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-line/60 pt-4">
              {/* A link, not an input. Every filter on this page is a URL, which
                  keeps the screen a server component and makes any view
                  shareable as a link. */}
              <Link
                href={filterHref(current, { includeSuspicious: !includeSuspicious })}
                className="inline-flex items-center gap-2 text-xs text-muted transition-colors hover:text-ink"
              >
                <span
                  aria-hidden
                  className={`flex size-4 items-center justify-center rounded border text-[10px] ${
                    !includeSuspicious
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line text-transparent'
                  }`}
                >
                  ✓
                </span>
                <Hint text="A match is flagged when two or more players on either side have fewer than five games on the hero they picked. Usually that means a new account rather than a new player — professionals appear on fresh accounts constantly, and no public API links those back. The prediction is still made and still stored; this only leaves it out of what is counted.">
                  Hide matches built on thin hero records
                </Hint>
              </Link>
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

      <Panel
        title={`Predictions (${list?.count ?? 0})`}
        action={
          selected ? (
            <span className="text-xs text-faint">
              {selected.leagueName ?? `League ${selected.leagueId}`}
            </span>
          ) : undefined
        }
      >
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
                      <Hint text="Radiant score – Dire score. Each is a weighted sum of the side's five players: their win rates on the heroes they picked (0.50), how those five heroes fare against the other five (0.40), and how many games they have on them (0.10). Higher is stronger, and the numbers only mean anything against each other.">
                        {prediction.radiantScore} – {prediction.direScore}
                      </Hint>{' '}
                      ·{' '}
                      <Hint text="How far apart the two scores are, as a share of the higher one. This is the confidence in the prediction — a bigger gap is a stronger call.">
                        {prediction.marginPercent}% margin
                      </Hint>
                      {!prediction.complete && <span className="text-warn"> · incomplete</span>}
                      {prediction.suspicious && <span className="text-warn"> · thin records</span>}
                    </div>
                    {prediction.leagueName && (
                      <div className="mt-0.5 truncate text-xs text-faint">
                        {prediction.leagueName.trim()}
                      </div>
                    )}
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
            {leagueId
              ? 'No predictions for this tournament.'
              : 'No predictions yet. One is made per tracked match once its draft is complete.'}
          </p>
        )}
      </Panel>
    </div>
  );
}
