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
  if (url) return url;

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
}

export interface PredictionPlayer {
  accountId: number;
  personaName?: string;
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
  radiantTeamName?: string;
  direTeamName?: string;
  radiantScore: number;
  direScore: number;
  favoured: 'radiant' | 'dire' | null;
  margin: number;
  marginPercent: number;
  radiantPlayers: PredictionPlayer[];
  direPlayers: PredictionPlayer[];
  complete: boolean;
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

export interface Accuracy {
  minMarginPercent: number;
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
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  workers: () => get<{ workers: WorkerRow[] }>('/workers'),
  discoveryStatus: () => get<DiscoveryStatus>('/discovery/status'),
  backfillStatus: () => get<BackfillStatus>('/backfill/status'),
  liveMatches: () => get<{ count: number; matches: LiveMatch[] }>('/matches/live'),
  recentMatches: () => get<{ count: number; matches: LiveMatch[] }>('/matches/recent'),
  predictions: () => get<{ count: number; predictions: Prediction[] }>('/predictions'),
  prediction: (matchId: number) => get<Prediction>(`/predictions/${matchId}`),
  series: (matchId: number) =>
    get<{ matchId: number; count: number; points: SeriesPoint[] }>(`/snapshots/${matchId}/series`),
  logs: (level: string) => get<LogsResponse>(`/logs?level=${level}&hours=24&limit=100`),
  accuracy: (minMarginPercent: number) =>
    get<Accuracy>(`/predictions/accuracy?minMarginPercent=${minMarginPercent}`),
};

/** Writes. Used only from server actions. */
export async function post(path: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
