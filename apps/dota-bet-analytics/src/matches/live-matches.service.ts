import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

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

@Injectable()
export class LiveMatchesService {
  constructor(@InjectModel(LiveMatch.name) private readonly model: Model<LiveMatch>) {}

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
            $set: { ...match, status: 'live' as const, lastSeenAt: seenAt },
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
    const stale = await this.model
      .find({ status: 'live', matchId: { $nin: seenIds } })
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

  async findRecent(limit = 50): Promise<LiveMatch[]> {
    return this.model.find().sort({ lastSeenAt: -1 }).limit(limit).lean<LiveMatch[]>().exec();
  }
}
