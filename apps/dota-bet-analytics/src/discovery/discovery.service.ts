import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';

import { HttpObserver } from '../common/http-observer.js';
import { fetchJson } from '../common/http.js';
import type { Env } from '../config/env.schema.js';
import { LeaguesService } from '../leagues/leagues.service.js';
import { AppLogger } from '../logger/logger.service.js';
import { LiveMatchesService, type ObservedMatch } from '../matches/live-matches.service.js';
import type { Prediction } from '../predictions/prediction.schema.js';
import { PredictionsService } from '../predictions/predictions.service.js';
import { ReportService } from '../report/report.service.js';
import { SnapshotsService } from '../snapshots/snapshots.service.js';
import { WorkerStateService } from '../workers/worker-state.service.js';
import type { GetLiveLeagueGamesResponse, SteamLiveGame } from './steam.types.js';

export interface DiscoveryStatus {
  paused: boolean;
  running: boolean;
  lastPollAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  liveMatchCount: number;
  lastPollSawGames: number;
  lastSnapshotsWritten: number;
}

@Injectable()
export class DiscoveryService {
  private lastPollAt: Date | null = null;
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;
  private liveMatchCount = 0;
  private lastPollSawGames = 0;
  private lastSnapshotsWritten = 0;
  /** Guards against a slow poll overlapping the next tick. */
  private polling = false;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly leagues: LeaguesService,
    private readonly liveMatches: LiveMatchesService,
    private readonly snapshots: SnapshotsService,
    private readonly predictions: PredictionsService,
    private readonly report: ReportService,
    private readonly workers: WorkerStateService,
    private readonly http: HttpObserver,
    private readonly logger: AppLogger,
  ) {}

  async status(): Promise<DiscoveryStatus> {
    return {
      paused: await this.workers.isPaused('discovery'),
      running: this.polling,
      lastPollAt: this.lastPollAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      liveMatchCount: this.liveMatchCount,
      lastPollSawGames: this.lastPollSawGames,
      lastSnapshotsWritten: this.lastSnapshotsWritten,
    };
  }

  /**
   * Valve refreshes roughly every 6–9 seconds, so 10s captures most updates.
   * At this rate one match costs about 8,600 calls a day against a ~100k
   * limit, and the calls are per poll rather than per match.
   */
  @Interval('discovery', 10_000)
  async poll(): Promise<void> {
    /* Read every tick rather than cached, so resuming takes effect on the
       next poll instead of needing a restart. */
    if (await this.workers.isPaused('discovery')) {
      return;
    }

    if (this.polling) {
      // A poll that outran its interval. Skipping is correct — the next tick
      // is 10s away and the feed is not going anywhere.
      this.logger.warn('discovery poll skipped, previous still running', {
        context: 'Discovery',
      });
      return;
    }

    this.polling = true;
    this.lastPollAt = new Date();

    let toReport: Prediction[] = [];

    try {
      toReport = await this.runPoll();
      this.lastSuccessAt = new Date();
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error('discovery poll failed', error instanceof Error ? error : undefined, {
        context: 'Discovery',
        reason: this.lastError,
      });
    } finally {
      this.polling = false;
    }

    /**
     * Mail is sent **after** the overlap guard is released, deliberately.
     *
     * A mail server that hangs takes as long as its timeout to fail, which is
     * far longer than the 10s interval — awaited inside the guard, one slow
     * send stops discovery for every tick until it gives up, and the feed is
     * gone by then. Out here it delays only the email.
     *
     * `send` reports its own failures and never throws, so nothing can escape
     * into an unhandled rejection.
     */
    for (const prediction of toReport) {
      await this.report.send(prediction);
    }
  }

  /** Returns the predictions made this poll, for the caller to email. */
  private async runPoll(): Promise<Prediction[]> {
    const key = this.config.get('STEAM_API_KEY', { infer: true });
    const payload = await fetchJson<GetLiveLeagueGamesResponse>(
      `https://api.steampowered.com/IDOTA2Match_570/GetLiveLeagueGames/v1/?key=${key}`,
      { observer: this.http.for('steam') },
    );

    const games = payload.result?.games ?? [];
    this.lastPollSawGames = games.length;

    /* One lookup per distinct league in the feed, cached after the first
       time — a poll sees the same dozen tournaments over and over. */
    const leagueIds = [...new Set(games.map((game) => game.league_id).filter(Boolean))];
    const tracked = new Map<number, string | undefined>();
    for (const id of leagueIds) {
      const decision = await this.leagues.resolve(id!);
      if (decision.tracked) {
        tracked.set(id!, decision.name);
      }
    }

    const observed: ObservedMatch[] = [];
    const trackedGames: SteamLiveGame[] = [];

    for (const game of games) {
      const match = this.toObserved(game, tracked);
      if (match) {
        observed.push(match);
        trackedGames.push(game);
      }
    }

    const seenAt = new Date();
    const started = await this.liveMatches.recordSeen(observed, seenAt);
    const ended = await this.liveMatches.endMatchesMissingFrom(
      observed.map((match) => match.matchId),
      seenAt,
    );

    /* Same fetch, second consumer. The scoreboard is already in this payload,
       so the archive costs no extra API call. */
    this.lastSnapshotsWritten = await this.snapshots.recordFrom(trackedGames, seenAt);

    this.liveMatchCount = observed.length;

    for (const matchId of started) {
      const match = observed.find((candidate) => candidate.matchId === matchId);
      this.logger.log('match started', {
        context: 'Discovery',
        matchId,
        leagueId: match?.leagueId,
        radiant: match?.radiantTeamName,
        dire: match?.direTeamName,
        streamDelaySeconds: match?.streamDelaySeconds,
      });
    }

    const predicted = await this.predictNewMatches(trackedGames, observed);

    for (const matchId of ended) {
      this.logger.log('match ended', { context: 'Discovery', matchId });
    }

    /* One line per poll, so "is it healthy right now" is a single query
       rather than an inference from the absence of errors. */
    this.logger.debug('discovery poll complete', {
      context: 'Discovery',
      gamesInFeed: games.length,
      tracked: observed.length,
      started: started.length,
      ended: ended.length,
      snapshots: this.lastSnapshotsWritten,
    });

    return predicted;
  }

  /**
   * Scores any live match we have not predicted yet.
   *
   * Keyed on the prediction existing rather than on "just started", because a
   * match discovered before its draft finished has nothing to score — the next
   * poll picks it up once heroes are locked in.
   *
   * A failure here must not fail the poll: the registry and the archive have
   * already been written, and those matter more than a prediction.
   *
   * Returns what it scored rather than emailing it. The console shows every
   * prediction the moment it is stored; the email is the push copy, and it is
   * sent by the caller once the poll is out of the way.
   */
  private async predictNewMatches(
    games: SteamLiveGame[],
    observed: ObservedMatch[],
  ): Promise<Prediction[]> {
    const predicted: Prediction[] = [];

    for (const game of games) {
      const match = observed.find((candidate) => candidate.matchId === game.match_id);
      if (!match) {
        continue;
      }

      try {
        if (await this.predictions.existsFor(match.matchId)) {
          continue;
        }
        /* The tournament's name, not just its id. Looked up once per new
           match, which is the only time a prediction is made. */
        const league = await this.leagues.findByLeagueId(match.leagueId);

        const prediction = await this.predictions.analyse(game, {
          matchId: match.matchId,
          leagueId: match.leagueId,
          leagueName: league?.name,
          leagueTier: league?.tier,
          radiantTeamName: match.radiantTeamName,
          direTeamName: match.direTeamName,
          radiantTeamId: match.radiantTeamId,
          direTeamId: match.direTeamId,
          streamDelaySeconds: match.streamDelaySeconds,
        });

        if (prediction) {
          predicted.push(prediction);
        }
      } catch (error) {
        this.logger.error('prediction failed', error instanceof Error ? error : undefined, {
          context: 'Discovery',
          matchId: match.matchId,
        });
      }
    }

    return predicted;
  }

  /** Keeps a game only if it is a tracked league and carries a usable id. */
  private toObserved(
    game: SteamLiveGame,
    tracked: Map<number, string | undefined>,
  ): ObservedMatch | null {
    const matchId = game.match_id;
    const leagueId = game.league_id;

    if (typeof matchId !== 'number' || typeof leagueId !== 'number') {
      return null;
    }
    if (!tracked.has(leagueId)) {
      return null;
    }

    return {
      matchId,
      leagueId,
      leagueName: tracked.get(leagueId),
      radiantTeamId: game.radiant_team?.team_id,
      radiantTeamName: game.radiant_team?.team_name,
      direTeamId: game.dire_team?.team_id,
      direTeamName: game.dire_team?.team_name,
      seriesType: game.series_type ?? 0,
      radiantSeriesWins: game.radiant_series_wins ?? 0,
      direSeriesWins: game.dire_series_wins ?? 0,
      streamDelaySeconds: game.stream_delay_s,
      spectators: game.spectators,
    };
  }
}
