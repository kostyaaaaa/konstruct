import { runBackfill } from './actions';
import { Panel } from '@/components/Panel';
import { Stat } from '@/components/Stat';
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
  return seconds > 60 ? ('bad' as const) : ('ok' as const);
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
          <code className="font-mono text-ink">dota-bet-analytics</code> is running on its port and
          that <code className="font-mono text-ink">API_URL</code> is set.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <Panel title="Discovery">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat
            label="Last poll"
            value={ago(discovery.lastSuccessAt)}
            hint={discovery.paused ? 'worker paused' : 'every 10s'}
            tone={pollTone(discovery.lastSuccessAt, discovery.paused)}
          />
          <Stat
            label="Live matches"
            value={discovery.liveMatchCount}
            hint={`${discovery.lastPollSawGames} in feed`}
          />
          <Stat label="Snapshots / poll" value={discovery.lastSnapshotsWritten} />
          <Stat
            label="Last error"
            value={discovery.lastError ? 'yes' : 'none'}
            hint={discovery.lastError ?? undefined}
            tone={discovery.lastError ? 'bad' : 'ok'}
          />
        </div>
      </Panel>

      <Panel
        title="Backfill"
        action={
          <form action={runBackfill}>
            <button
              type="submit"
              className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              Run now
            </button>
          </form>
        }
      >
        {backfill ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Last run" value={ago(backfill.lastRunAt)} hint="every 5m" />
            <Stat label="Resolved" value={backfill.lastResolved} hint="last run" />
            <Stat label="Awaiting result" value={backfill.lastPending} />
            <Stat
              label="Last error"
              value={backfill.lastError ? 'yes' : 'none'}
              hint={backfill.lastError ?? undefined}
              tone={backfill.lastError ? 'bad' : 'ok'}
            />
          </div>
        ) : (
          <p className="text-sm text-muted">Status unavailable.</p>
        )}
      </Panel>

      <Panel title="Workers">
        {workers.workers.map((worker) => (
          <WorkerRow key={worker.name} worker={worker} />
        ))}
        <p className="mt-4 text-xs text-faint">
          Pausing stops the work, not the process. The state is stored in the database, so it
          survives a restart.
        </p>
      </Panel>

      {live && live.count > 0 && (
        <Panel title="Live now">
          <ul className="space-y-2 text-sm">
            {live.matches.map((match) => (
              <li key={match.matchId} className="flex justify-between gap-4">
                <span>
                  {match.radiantTeamName ?? '?'} <span className="text-faint">vs</span>{' '}
                  {match.direTeamName ?? '?'}
                </span>
                <span className="font-mono text-xs text-faint">
                  {match.radiantSeriesWins}–{match.direSeriesWins}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
