import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export const MATCH_STATUS = ['live', 'ended'] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

/**
 * The registry of professional matches we have seen live.
 *
 * One row per match, updated in place — this is current state, not history.
 * The append-only time series lives in `match_snapshots`.
 */
@Schema({ collection: 'live_matches', timestamps: true })
export class LiveMatch {
  /** Valve's match id. Stable, and the join key to OpenDota for backfill. */
  @Prop({ required: true, unique: true, index: true })
  matchId!: number;

  @Prop({ required: true, index: true })
  leagueId!: number;

  @Prop()
  leagueName?: string;

  @Prop()
  radiantTeamId?: number;

  @Prop()
  radiantTeamName?: string;

  @Prop()
  direTeamId?: number;

  @Prop()
  direTeamName?: string;

  /** 0 none, 1 best-of-3, 2 best-of-5. */
  @Prop({ default: 0 })
  seriesType!: number;

  @Prop({ default: 0 })
  radiantSeriesWins!: number;

  @Prop({ default: 0 })
  direSeriesWins!: number;

  /**
   * DotaTV delay in seconds, as Valve reports it. Observed between 120 and 900
   * on a single sample, so it is stored rather than assumed.
   */
  @Prop()
  streamDelaySeconds?: number;

  @Prop()
  spectators?: number;

  @Prop({ required: true, enum: MATCH_STATUS, index: true })
  status!: MatchStatus;

  /** First poll that saw this match. */
  @Prop({ required: true })
  startedAt!: Date;

  /** Last poll that saw it. Drives end detection. */
  @Prop({ required: true, index: true })
  lastSeenAt!: Date;

  /** First poll that did not see it after it was live. */
  @Prop()
  endedAt?: Date;
}

export type LiveMatchDocument = HydratedDocument<LiveMatch>;
export const LiveMatchSchema = SchemaFactory.createForClass(LiveMatch);
