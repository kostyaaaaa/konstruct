import { runBackfill } from './actions';
import { Panel } from '@/components/Panel';
import { Stat, StatGrid } from '@/components/Stat';
import { WorkerRow } from '@/components/WorkerRow';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

function ago(iso: string | null): string {
  if (!iso) {
    return 'never';
  }
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ago`;
  }
  return `${Math.round(seconds / 3600)}h ago`;
}

/** More than a minute without a successful poll means something is wrong. */
function pollTone(lastSuccessAt: string | null, paused: boolean) {
  if (paused) {
    return 'warn' as const;
  }
  if (!lastSuccessAt) {
    return 'bad' as const;
  }
  const seconds = (Date.now() - new Date(lastSuccessAt).getTime()) / 1000;
  return seconds > 60 ? ('bad' as const) : ('accent' as const);
}

export default async function ControlPage() {
  const [workers, discovery, backfill, live] = await Promise.all([
    api.workers(),
    api.discoveryStatus(),
    api.backfillStatus(),
    api.liveMatches(),
  ]);

  if (!workers || !discovery) {
    return (
      <Panel title="API unreachable">
        <p className="text-sm text-muted">
          The console cannot reach the API. Check that{' '}
          <code className="mono text-ink">dota-bet-analytics</code> is running and that{' '}
          <code className="mono text-ink">API_URL</code> is set.
        </p>
      </Panel>
    );
  }

  return (
    <>
      <Panel title="Discovery" flush>
        <StatGrid>
          <Stat
            label="Last poll"
            value={ago(discovery.lastSuccessAt)}
            hint={discovery.paused ? 'Paused' : 'Last poll'}
            title="How long ago the discovery worker last finished a poll of Steam's live games feed. It polls every 10 seconds, so anything over a minute means something is wrong."
            tone={pollTone(discovery.lastSuccessAt, discovery.paused)}
          />
          <Stat
            label="Live matches"
            value={discovery.liveMatchCount}
            hint={`${discovery.lastPollSawGames} in feed`}
            title={`Professional matches live right now in a tracked tier 1-2 league. The feed returned ${discovery.lastPollSawGames} games in total on the last poll; the rest are in leagues we do not track.`}
          />
          <Stat
            label="Snapshots / poll"
            value={discovery.lastSnapshotsWritten}
            title="Rows added to the snapshot archive on the last poll — one per live tracked match. It should equal the live match count."
          />
          <Stat
            label="Last error"
            value={discovery.lastError ? 'yes' : 'none'}
            hint={discovery.lastError ?? 'Last error'}
            title={
              discovery.lastError
                ? 'The error from the most recent failed poll. It clears as soon as a poll succeeds.'
                : 'Whether the most recent discovery poll failed. Cleared by the next successful poll.'
            }
            tone={discovery.lastError ? 'bad' : 'muted'}
          />
        </StatGrid>
      </Panel>

      <Panel
        title="Backfill"
        flush
        action={
          <form action={runBackfill}>
            <button
              type="submit"
              className="rounded-md border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              Run now
            </button>
          </form>
        }
      >
        {backfill ? (
          <StatGrid>
            <Stat
              label="Last run"
              value={ago(backfill.lastRunAt)}
              title="How long ago the backfill worker last looked for finished matches. It fills in who actually won, which is what turns a prediction into a correct or wrong one."
              tone="muted"
            />
            <Stat
              label="Resolved"
              value={backfill.lastResolved}
              title="Matches given a winner on the last run. Each one settles its prediction."
            />
            <Stat
              label="Awaiting result"
              value={backfill.lastPending}
              title="Matches that have ended but whose result OpenDota has not published yet. They are retried on the next run."
            />
            <Stat
              label="Last error"
              value={backfill.lastError ? 'yes' : 'none'}
              hint={backfill.lastError ?? 'Last error'}
              title={
                backfill.lastError
                  ? 'The error from the most recent failed backfill run.'
                  : 'Whether the most recent backfill run failed.'
              }
              tone={backfill.lastError ? 'bad' : 'muted'}
            />
          </StatGrid>
        ) : (
          <p className="px-[18px] py-4 text-sm text-muted">Status unavailable.</p>
        )}
      </Panel>

      <Panel title="Workers">
        {workers.workers.map((worker) => (
          <WorkerRow key={worker.name} worker={worker} />
        ))}
      </Panel>

      {live && live.count > 0 && (
        <Panel title="Live now">
          <ul className="flex flex-col gap-2 text-sm">
            {live.matches.map((match) => (
              <li key={match.matchId} className="flex justify-between gap-4">
                <span>
                  <span className="text-radiant">{match.radiantTeamName ?? 'Radiant'}</span>
                  <span className="px-2 text-faint">vs</span>
                  <span className="text-dire">{match.direTeamName ?? 'Dire'}</span>
                </span>
                <span className="mono text-xs text-faint">
                  {match.radiantSeriesWins}–{match.direSeriesWins}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
