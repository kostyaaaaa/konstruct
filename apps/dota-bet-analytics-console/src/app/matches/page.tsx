import Link from 'next/link';

import { Panel } from '@/components/Panel';
import { api, type LiveMatch } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SERIES_LABEL: Record<number, string> = { 0: '', 1: 'Bo3', 2: 'Bo5' };

/**
 * Whether a live match has been scored yet.
 *
 * Two states, and no countdown. The wait for the delayed scoreboard can be
 * timed to within a poll, but the draft after it cannot — one in ten runs past
 * fifteen minutes — so any figure covering both would look exact and be wrong.
 */
function progress(match: LiveMatch): { label: string; title: string; tone: string } | null {
  if (match.status !== 'live') {
    return null;
  }

  return match.hasPrediction
    ? { label: 'predicted', title: 'Scored. Open the match to see it.', tone: 'text-ok' }
    : {
        label: 'awaiting prediction',
        title:
          'Not scored yet. Either the delayed scoreboard has not arrived, or the teams are still drafting — a prediction is made within seconds of the fifth pick.',
        tone: 'text-faint',
      };
}

function MatchRow({ match }: { match: LiveMatch }) {
  const state = progress(match);

  return (
    <Link
      href={`/matches/${match.matchId}`}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 py-3 transition-colors last:border-0 hover:bg-field"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${
              match.status === 'live' ? 'bg-ok' : 'bg-line-strong'
            }`}
            aria-hidden
          />
          <span className="truncate">
            <span className="text-radiant">{match.radiantTeamName ?? 'Radiant'}</span>
            <span className="px-2 text-faint">vs</span>
            <span className="text-dire">{match.direTeamName ?? 'Dire'}</span>
          </span>
        </div>
        <div className="mt-0.5 pl-4 mono text-xs text-faint">
          {match.matchId}
          {SERIES_LABEL[match.seriesType] && ` · ${SERIES_LABEL[match.seriesType]}`}
          {` · series ${match.radiantSeriesWins}–${match.direSeriesWins}`}
        </div>
        {match.leagueName && (
          <div className="mt-0.5 truncate pl-4 text-xs text-faint">{match.leagueName}</div>
        )}
      </div>

      {/* Under the team names on a phone, aligned with them rather than
          against the right edge where it reads as a separate column. */}
      <div className="text-right text-xs text-faint max-sm:ml-[22px] max-sm:text-left">
        {state && (
          <div className={state.tone} title={state.title}>
            {state.label}
          </div>
        )}
        {match.streamDelaySeconds !== undefined && (
          <div>delay {Math.round(match.streamDelaySeconds / 60)}m</div>
        )}
        {match.spectators !== undefined && <div>{match.spectators} watching</div>}
      </div>
    </Link>
  );
}

export default async function MatchesPage() {
  const [live, recent] = await Promise.all([api.liveMatches(), api.recentMatches()]);

  if (!live && !recent) {
    return (
      <Panel title="API unreachable">
        <p className="text-sm text-muted">Could not load matches.</p>
      </Panel>
    );
  }

  const ended = (recent?.matches ?? []).filter((match) => match.status === 'ended');

  return (
    <div className="space-y-6">
      <Panel title={`Live (${live?.count ?? 0})`}>
        {live && live.count > 0 ? (
          live.matches.map((match) => <MatchRow key={match.matchId} match={match} />)
        ) : (
          <p className="text-sm text-muted">
            Nothing live right now. Only tournaments with a prize pool above the configured minimum
            are tracked, so quiet periods are normal.
          </p>
        )}
      </Panel>

      <Panel title={`Recently ended (${ended.length})`}>
        {ended.length > 0 ? (
          ended.map((match) => <MatchRow key={match.matchId} match={match} />)
        ) : (
          <p className="text-sm text-muted">Nothing yet.</p>
        )}
      </Panel>
    </div>
  );
}
