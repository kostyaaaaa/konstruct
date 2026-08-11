import 'server-only';

/**
 * Talks to the dota-bet-analytics API.
 *
 * `server-only` at the top is load-bearing: it makes the build fail if this
 * module is ever imported into a client component. The API is not public, and
 * its URL is not a `NEXT_PUBLIC_` value, so it must never be bundled for the
 * browser.
 */

/** Where the API is, per environment. Set in Infisical, never in code. */
const DEV_FALLBACK = 'http://localhost:4001';

function baseUrl(): string {
  const url = process.env.API_URL;
  if (url) {
    return url;
  }

  /* Outside dev there is no sensible guess — localhost would be this server,
     not the API. Say so loudly rather than failing with a confusing timeout. */
  if (process.env.ENV && process.env.ENV !== 'dev') {
    console.error(
      `[console] API_URL is not set for ENV=${process.env.ENV}. Every request will fail.`,
    );
  }

  return DEV_FALLBACK;
}

export interface WorkerRow {
  name: string;
  status: 'running' | 'paused';
  lastChangedAt?: string;
}

export interface DiscoveryStatus {
  paused: boolean;
  running: boolean;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  liveMatchCount: number;
  lastPollSawGames: number;
  lastSnapshotsWritten: number;
}

export interface BackfillStatus {
  paused: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  lastResolved: number;
  lastPending: number;
}

export interface LiveMatch {
  matchId: number;
  leagueId: number;
  leagueName?: string;
  radiantTeamName?: string;
  direTeamName?: string;
  seriesType: number;
  radiantSeriesWins: number;
  direSeriesWins: number;
  streamDelaySeconds?: number;
  spectators?: number;
  status: 'live' | 'ended';
  startedAt: string;
  lastSeenAt: string;
  /** Live matches only: whether this has been scored yet. */
  hasPrediction?: boolean;
  /** Live matches only: seconds until the delayed scoreboard is due. */
  scoreboardInSeconds?: number | null;
}

export interface PredictionPlayer {
  accountId: number;
  personaName?: string;
  /** Competitive nickname, when the player is a registered professional. */
  proName?: string;
  heroId: number;
  heroName?: string;
  heroImageUrl?: string;
  winRate: number | null;
  heroRank: number | null;
  gamesOnHero: number;
  leaderboardRank?: number;
  missing: boolean;
}

export interface Prediction {
  matchId: number;
  leagueId: number;
  radiantTeamName?: string;
  direTeamName?: string;
  radiantScore: number;
  direScore: number;
  favoured: 'radiant' | 'dire' | null;
  margin: number;
  /** How this side's five heroes fare against the other five, 0-100. The two sum to 100. */
  radiantMatchup?: number;
  direMatchup?: number;
  leagueName?: string;
  leagueTier?: string;
  marginPercent: number;
  /** Broadcast delay on the match, in seconds. */
  streamDelaySeconds?: number;
  radiantPlayers: PredictionPlayer[];
  direPlayers: PredictionPlayer[];
  complete: boolean;
  /** Two or more players on a side had under 5 games on their picked hero. */
  suspicious: boolean;
  winner: string | null;
  correct: boolean | null;
  createdAt: string;
}

export interface SeriesPoint {
  capturedAt: string;
  gameTime: number;
  radiantNetWorth: number;
  direNetWorth: number;
  radiantScore: number;
  direScore: number;
}

export interface LogRow {
  time: string;
  level: string;
  message: string;
  service?: string;
  env?: string;
  context?: string;
}

export interface LogsResponse {
  available: boolean;
  reason?: string;
  rows: LogRow[];
}

/** One tournament, with how the model has done in it so far. */
export interface PredictionLeague {
  leagueId: number;
  leagueName?: string;
  /** Predictions made, settled or not. */
  count: number;
  settled: number;
  correct: number;
  accuracyPercent: number | null;
}

export interface Accuracy {
  minMarginPercent: number;
  leagueId: number | null;
  includeSuspicious: boolean;
  settled: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number | null;
}

/**
 * Every read goes through here.
 *
 * `cache: 'no-store'` because this is an operations console — a cached "worker
 * is running" is worse than a slow one. Failures return null rather than
 * throwing, so one dead endpoint degrades a panel instead of blanking the
 * whole page.
 */
async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** The prediction filters, as a query string. Omitted when at their default. */
function filters(
  leagueId: number | undefined,
  includeSuspicious: boolean,
  minMarginPercent = 0,
): string {
  const params = new URLSearchParams();
  if (leagueId) {
    params.set('league', String(leagueId));
  }
  if (!includeSuspicious) {
    params.set('includeSuspicious', 'false');
  }
  if (minMarginPercent > 0) {
    params.set('minMarginPercent', String(minMarginPercent));
  }
  return params.toString();
}

export const api = {
  workers: () => get<{ workers: WorkerRow[] }>('/workers'),
  discoveryStatus: () => get<DiscoveryStatus>('/discovery/status'),
  backfillStatus: () => get<BackfillStatus>('/backfill/status'),
  liveMatches: () => get<{ count: number; matches: LiveMatch[] }>('/matches/live'),
  recentMatches: () => get<{ count: number; matches: LiveMatch[] }>('/matches/recent'),
  predictions: (leagueId?: number, includeSuspicious = true, minMarginPercent = 0) =>
    get<{ count: number; predictions: Prediction[] }>(
      `/predictions?${filters(leagueId, includeSuspicious, minMarginPercent)}`,
    ),
  predictionLeagues: (includeSuspicious = true) =>
    get<{ count: number; leagues: PredictionLeague[] }>(
      `/predictions/leagues?${filters(undefined, includeSuspicious)}`,
    ),
  prediction: (matchId: number) => get<Prediction>(`/predictions/${matchId}`),
  series: (matchId: number) =>
    get<{ matchId: number; count: number; points: SeriesPoint[] }>(`/snapshots/${matchId}/series`),
  logs: (level: string, env?: string) =>
    get<LogsResponse>(
      `/logs?level=${level}&hours=24&limit=100${env ? `&env=${encodeURIComponent(env)}` : ''}`,
    ),
  accuracy: (minMarginPercent: number, leagueId?: number, includeSuspicious = true) =>
    get<Accuracy>(
      `/predictions/accuracy?minMarginPercent=${minMarginPercent}&${filters(leagueId, includeSuspicious)}`,
    ),
};

/** Writes. Used only from server actions. */
/**
 * Returns the outcome rather than throwing, so a failed control action
 * degrades the page instead of taking it down.
 *
 * `status` is carried out so a log line can say *why* it failed — a 404 from a
 * renamed worker and an unreachable API are the same `false` otherwise, and
 * telling them apart is the whole point of logging this.
 */
export async function post(path: string): Promise<{ ok: boolean; status?: number }> {
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false };
  }
}
