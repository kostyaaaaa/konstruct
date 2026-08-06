import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { SteamLiveGame, SteamScoreboardSide } from '../discovery/steam.types.js';
import { AppLogger } from '../logger/logger.service.js';
import { MatchSnapshot } from './match-snapshot.schema.js';

/** Net worth summed across a side's players. */
function netWorth(side: SteamScoreboardSide | undefined): number {
  return (side?.players ?? []).reduce((total, player) => total + (player.net_worth ?? 0), 0);
}

function heroIds(entries: { hero_id: number }[] | undefined): number[] {
  return (entries ?? []).map((entry) => entry.hero_id);
}

@Injectable()
export class SnapshotsService {
  constructor(
    @InjectModel(MatchSnapshot.name) private readonly model: Model<MatchSnapshot>,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Appends one snapshot per game that has a scoreboard.
   *
   * Called with the games the discovery poll already fetched — there is no
   * second request. `GetRealtimeStats` would be the obvious source but is
   * unreachable without a `server_steam_id`, and the scoreboard embedded here
   * carries the same state, so one call feeds both the registry and the
   * archive.
   */
  async recordFrom(games: SteamLiveGame[], capturedAt: Date): Promise<number> {
    const playable = games.filter((game) => typeof game.match_id === 'number' && game.scoreboard);
    if (playable.length === 0) return 0;

    /* The raw payload is 91% of a snapshot's size, and it is identical in
       shape for every snapshot of a match. Keeping it on the first one per
       match preserves the ability to re-extract a field Valve adds or
       renames, at roughly a tenth of the storage — a 40-minute match stores
       one raw payload instead of 240. */
    const seen = await this.model
      .distinct('matchId', { matchId: { $in: playable.map((game) => game.match_id as number) } })
      .exec();
    const alreadyArchived = new Set(seen as number[]);

    const documents = playable.map((game) =>
      this.toSnapshot(game, capturedAt, !alreadyArchived.has(game.match_id as number)),
    );

    try {
      /* Unordered so one duplicate cannot stop the rest of the batch. */
      await this.model.insertMany(documents, { ordered: false });
      return documents.length;
    } catch (error) {
      /* A duplicate key here means this poll was already recorded — harmless,
         and exactly what the unique index is for. Anything else is real. */
      const isDuplicate =
        typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;

      if (!isDuplicate) throw error;

      this.logger.warn('snapshot batch had duplicates, kept the rest', {
        context: 'Snapshots',
        batchSize: documents.length,
      });
      return documents.length;
    }
  }

  private toSnapshot(
    game: SteamLiveGame,
    capturedAt: Date,
    includeRaw: boolean,
  ): Partial<MatchSnapshot> {
    const board = game.scoreboard;
    const radiant = board?.radiant;
    const dire = board?.dire;

    return {
      matchId: game.match_id as number,
      capturedAt,
      gameTime: board?.duration ?? 0,
      streamDelaySeconds: game.stream_delay_s,
      radiantScore: radiant?.score ?? 0,
      direScore: dire?.score ?? 0,
      radiantNetWorth: netWorth(radiant),
      direNetWorth: netWorth(dire),
      radiantTowerState: radiant?.tower_state,
      direTowerState: dire?.tower_state,
      radiantBarracksState: radiant?.barracks_state,
      direBarracksState: dire?.barracks_state,
      roshanRespawnTimer: board?.roshan_respawn_timer,
      radiantPicks: heroIds(radiant?.picks),
      direPicks: heroIds(dire?.picks),
      radiantBans: heroIds(radiant?.bans),
      direBans: heroIds(dire?.bans),
      ...(includeRaw ? { raw: board as unknown as Record<string, unknown> } : {}),
    };
  }

  /** Every snapshot for a match, oldest first. */
  async findForMatch(matchId: number, limit = 500): Promise<MatchSnapshot[]> {
    return this.model
      .find({ matchId })
      .sort({ capturedAt: 1 })
      .limit(limit)
      .lean<MatchSnapshot[]>()
      .exec();
  }

  /** Trimmed series for a graph — no raw payloads. */
  async findSeries(matchId: number, limit = 500) {
    return this.model
      .find({ matchId })
      .select('capturedAt gameTime radiantNetWorth direNetWorth radiantScore direScore -_id')
      .sort({ capturedAt: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async countForMatch(matchId: number): Promise<number> {
    return this.model.countDocuments({ matchId });
  }
}
