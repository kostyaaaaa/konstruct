import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { PredictionsService } from '../predictions/predictions.service.js';
import { LiveMatch } from './live-match.schema.js';

/** What a poll observed about one match. */
export interface ObservedMatch {
  matchId: number;
  leagueId: number;
  leagueName?: string;
  radiantTeamId?: number;
  radiantTeamName?: string;
  direTeamId?: number;
  direTeamName?: string;
  seriesType: number;
  radiantSeriesWins: number;
  direSeriesWins: number;
  streamDelaySeconds?: number;
  spectators?: number;
}

/**
 * Successful polls a match must be absent from before it is called finished.
 *
 * Three polls is about thirty seconds. A real match that has ended stays
 * absent, so the cost of waiting is a slightly late `match ended`; the cost of
 * not waiting is live matches flipping to ended and back on one bad payload.
 */
const END_AFTER_MISSED_POLLS = 3;

/** A live match, plus how far it is from producing a prediction. */
export interface LiveMatchProgress extends LiveMatch {
  hasPrediction: boolean;
  /**
   * Seconds until the delayed scoreboard is due, or 0 once it should already
   * have arrived. Null when the league reports no delay.
   */
  scoreboardInSeconds: number | null;
}

/**
 * When the scoreboard for a match should first appear.
 *
 * Valve serves the scoreboard on the broadcast's delayed timeline, so it shows
 * up `streamDelaySeconds` after the match id enters the feed. Measured across
 * 261 matches this is accurate to about ten seconds — one poll — and 253 of
 * them landed within a minute.
 *
 * What happens *after* that is not predictable: the scoreboard arrives before
 * the draft, and how long five picks take is up to the teams. So this counts
 * down to the first thing we can see, and stops.
 */
function scoreboardInSeconds(match: LiveMatch, now: number): number | null {
  if (match.streamDelaySeconds === undefined) {
    return null;
  }
  const due = new Date(match.startedAt).getTime() + match.streamDelaySeconds * 1000;
  return Math.max(0, Math.round((due - now) / 1000));
}

@Injectable()
export class LiveMatchesService {
  constructor(
    @InjectModel(LiveMatch.name) private readonly model: Model<LiveMatch>,
    private readonly predictions: PredictionsService,
  ) {}

  /**
   * Records everything one poll saw, and returns the matches that were not
   * already live — those are the ones that just started.
   *
   * Idempotent by `matchId`: re-running a poll, or restarting mid-match,
   * updates the same row instead of creating another. `startedAt` is only ever
   * written on insert, so a restart cannot move it.
   */
  async recordSeen(observed: ObservedMatch[], seenAt: Date): Promise<number[]> {
    if (observed.length === 0) {
      return [];
    }

    const ids = observed.map((match) => match.matchId);
    const alreadyLive = await this.model
      .find({ matchId: { $in: ids }, status: 'live' })
      .select('matchId')
      .lean<{ matchId: number }[]>()
      .exec();
    const alreadyLiveIds = new Set(alreadyLive.map((match) => match.matchId));

    await this.model.bulkWrite(
      observed.map((match) => ({
        updateOne: {
          filter: { matchId: match.matchId },
          update: {
            $set: { ...match, status: 'live' as const, lastSeenAt: seenAt, missedPolls: 0 },
            $setOnInsert: { startedAt: seenAt },
            /* A match seen again has no end time — clear it rather than
               leaving a stale one from a previous disappearance. */
            $unset: { endedAt: '' },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    return ids.filter((id) => !alreadyLiveIds.has(id));
  }

  /**
   * Ends every match that is still marked live but was not in this poll.
   *
   * Also covers downtime: matches that finished while the process was stopped
   * are absent from the first poll after it comes back, so they end then.
   */
  async endMatchesMissingFrom(seenIds: number[], endedAt: Date): Promise<number[]> {
    /* Count the miss first, then end only what has missed enough of them.
       Callers must not invoke this after a failed poll — an empty feed we
       never received is not evidence that anything finished. */
    await this.model
      .updateMany({ status: 'live', matchId: { $nin: seenIds } }, { $inc: { missedPolls: 1 } })
      .exec();

    const stale = await this.model
      .find({
        status: 'live',
        matchId: { $nin: seenIds },
        missedPolls: { $gte: END_AFTER_MISSED_POLLS },
      })
      .select('matchId')
      .lean<{ matchId: number }[]>()
      .exec();

    if (stale.length === 0) {
      return [];
    }

    const staleIds = stale.map((match) => match.matchId);
    await this.model
      .updateMany({ matchId: { $in: staleIds } }, { $set: { status: 'ended', endedAt } })
      .exec();

    return staleIds;
  }

  /** Of the given ids, the ones that have finished. */
  async findEndedIds(matchIds: number[]): Promise<Set<number>> {
    if (matchIds.length === 0) {
      return new Set();
    }

    const ended = await this.model
      .find({ matchId: { $in: matchIds }, status: 'ended' })
      .select('matchId')
      .lean<{ matchId: number }[]>()
      .exec();

    return new Set(ended.map((match) => match.matchId));
  }

  async findLive(): Promise<LiveMatch[]> {
    return this.model.find({ status: 'live' }).sort({ startedAt: -1 }).lean<LiveMatch[]>().exec();
  }

  /** Live matches with the wait until each can be scored. */
  async findLiveWithProgress(): Promise<LiveMatchProgress[]> {
    const matches = await this.findLive();
    if (matches.length === 0) {
      return [];
    }

    const predicted = await this.predictions.existingFor(matches.map((match) => match.matchId));
    const now = Date.now();

    return matches.map((match) => ({
      ...match,
      hasPrediction: predicted.has(match.matchId),
      scoreboardInSeconds: scoreboardInSeconds(match, now),
    }));
  }

  async findRecent(limit = 50): Promise<LiveMatch[]> {
    return this.model.find().sort({ lastSeenAt: -1 }).limit(limit).lean<LiveMatch[]>().exec();
  }
}
