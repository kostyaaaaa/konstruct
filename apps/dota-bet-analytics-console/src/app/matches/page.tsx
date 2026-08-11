import Link from 'next/link';

import { Panel } from '@/components/Panel';
import { api, type LiveMatch } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SERIES_LABEL: Record<number, string> = { 0: '', 1: 'Bo3', 2: 'Bo5' };

/** `95` -> `2m`, rounded up so a countdown never reads `0m` while still waiting. */
function countdown(seconds: number): string {
  return seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)}m`;
}

/**
 * How close a live match is to being scored.
 *
 * Three states, and only the first is a real countdown. Valve serves the
 * scoreboard `stream_delay_s` after the match appears — accurate to about one
 * poll — so that wait can be counted down honestly. What follows is the draft,
 * whose length is up to the teams, so it is named rather than estimated.
 */
function progress(match: LiveMatch): { label: string; tone: string } | null {
  if (match.status !== 'live') {
    return null;
  }
  if (match.hasPrediction) {
    return { label: 'predicted', tone: 'text-ok' };
  }
  if (match.scoreboardInSeconds) {
    return { label: `scoreboard in ${countdown(match.scoreboardInSeconds)}`, tone: 'text-faint' };
  }
  return { label: 'awaiting draft', tone: 'text-warn' };
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
        {state && <div className={state.tone}>{state.label}</div>}
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
