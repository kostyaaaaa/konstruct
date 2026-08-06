import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { HttpClientError } from '../common/http.js';
import { AppLogger } from '../logger/logger.service.js';
import { LiveMatchesService } from '../matches/live-matches.service.js';
import { OpenDotaService } from '../opendota/opendota.service.js';
import { PredictionsService } from '../predictions/predictions.service.js';
import { WorkerStateService } from '../workers/worker-state.service.js';

/**
 * How many finished matches to resolve per run.
 *
 * OpenDota allows 60 requests a minute and 2,000 a day, and this runs every
 * five minutes, so a batch of 10 leaves plenty of room for the scoring, which
 * is the heavier user.
 */
const BATCH_SIZE = 10;

/**
 * Give up after this many tries — roughly two hours at a five-minute interval.
 * A pro match is normally parsed well inside that; one that is not, never will
 * be.
 */
const MAX_ATTEMPTS = 24;

export interface BackfillStatus {
  paused: boolean;
  running: boolean;
  lastRunAt: Date | null;
  lastError: string | null;
  lastResolved: number;
  lastPending: number;
}

@Injectable()
export class BackfillService {
  private lastRunAt: Date | null = null;
  private lastError: string | null = null;
  private lastResolved = 0;
  private lastPending = 0;
  private running = false;

  constructor(
    private readonly predictions: PredictionsService,
    private readonly liveMatches: LiveMatchesService,
    private readonly openDota: OpenDotaService,
    private readonly workers: WorkerStateService,
    private readonly logger: AppLogger,
  ) {}

  async status(): Promise<BackfillStatus> {
    return {
      paused: await this.workers.isPaused('backfill'),
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      lastResolved: this.lastResolved,
      lastPending: this.lastPending,
    };
  }

  @Interval('backfill', 5 * 60 * 1000)
  async run(): Promise<void> {
    if (await this.workers.isPaused('backfill')) {
      return;
    }
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastRunAt = new Date();

    try {
      this.lastResolved = await this.resolveFinished();
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error('backfill run failed', error instanceof Error ? error : undefined, {
        context: 'Backfill',
        reason: this.lastError,
      });
    } finally {
      this.running = false;
    }
  }

  /** Fills in the winner for predictions whose match has finished. */
  async resolveFinished(): Promise<number> {
    const pending = await this.predictions.findAwaitingWinner(BATCH_SIZE, MAX_ATTEMPTS);
    this.lastPending = pending.length;
    if (pending.length === 0) {
      return 0;
    }

    /* Only ask about matches the registry says are over. Asking while a match
       is still running wastes an attempt on a result that cannot exist yet. */
    const ended = await this.liveMatches.findEndedIds(pending.map((p) => p.matchId));
    let resolved = 0;

    for (const prediction of pending) {
      if (!ended.has(prediction.matchId)) {
        continue;
      }

      await this.predictions.noteBackfillAttempt(prediction.matchId);

      const outcome = await this.fetchOutcome(prediction);
      if (!outcome) {
        continue;
      }

      await this.predictions.setOutcome(prediction.matchId, outcome.winner, outcome.radiantWon);
      resolved += 1;

      this.logger.log('match result recorded', {
        context: 'Backfill',
        matchId: prediction.matchId,
        winner: outcome.winner,
        radiantWon: outcome.radiantWon,
        favoured: prediction.favoured,
      });
    }

    this.logger.debug('backfill run complete', {
      context: 'Backfill',
      pending: pending.length,
      ended: ended.size,
      resolved,
    });

    return resolved;
  }

  /**
   * Which side won, and its team name, or null while the match is not parsed
   * yet.
   *
   * Both are returned: the name is for display, the side is what decides
   * whether the prediction was right.
   *
   * "Not ready" and "broken" are different: a 404 or a missing `radiant_win`
   * means OpenDota has not finished with it, which is normal for minutes after
   * a match ends. Anything else is a real failure and is re-thrown.
   */
  private async fetchOutcome(prediction: {
    matchId: number;
    radiantTeamName?: string;
    direTeamName?: string;
  }): Promise<{ winner: string; radiantWon: boolean } | null> {
    try {
      const detail = await this.openDota.matchDetail(prediction.matchId);
      if (detail?.radiant_win === undefined) {
        return null;
      }

      const radiantWon = detail.radiant_win;
      return {
        radiantWon,
        winner: radiantWon
          ? (prediction.radiantTeamName ?? 'radiant')
          : (prediction.direTeamName ?? 'dire'),
      };
    } catch (error) {
      if (error instanceof HttpClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }
}
