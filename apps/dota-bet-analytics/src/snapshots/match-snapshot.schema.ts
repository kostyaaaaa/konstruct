import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * One observation of one live match. **Append-only** — nothing here is ever
 * updated or deleted.
 *
 * This collection is the product. Everything else can be rebuilt from an API;
 * this cannot, because Valve serves only the current state and keeps no
 * history.
 *
 * The raw payload is stored next to the extracted columns on purpose. Valve
 * changes response shapes without notice — `server_steam_id` has already
 * disappeared from this feed once — and re-extracting from raw later is
 * possible, while recovering a field that was never stored is not.
 */
@Schema({ collection: 'match_snapshots', timestamps: { createdAt: true, updatedAt: false } })
export class MatchSnapshot {
  @Prop({ required: true, index: true })
  matchId!: number;

  /** Wall clock. Kept alongside `gameTime` because the two diverge. */
  @Prop({ required: true })
  capturedAt!: Date;

  /**
   * In-game clock in seconds, from the scoreboard's `duration`.
   *
   * A pause shows up as this value repeating while `capturedAt` advances,
   * which is the only way to see a pause at all. Any time-series work has to
   * use this rather than wall clock.
   */
  @Prop({ required: true })
  gameTime!: number;

  /** Valve's reported DotaTV delay at capture. Varies per match and over time. */
  @Prop()
  streamDelaySeconds?: number;

  @Prop({ default: 0 })
  radiantScore!: number;

  @Prop({ default: 0 })
  direScore!: number;

  @Prop({ default: 0 })
  radiantNetWorth!: number;

  @Prop({ default: 0 })
  direNetWorth!: number;

  /** Bitmasks. 2047 means every tower still standing. */
  @Prop()
  radiantTowerState?: number;

  @Prop()
  direTowerState?: number;

  @Prop()
  radiantBarracksState?: number;

  @Prop()
  direBarracksState?: number;

  @Prop()
  roshanRespawnTimer?: number;

  @Prop({ type: [Number], default: [] })
  radiantPicks!: number[];

  @Prop({ type: [Number], default: [] })
  direPicks!: number[];

  @Prop({ type: [Number], default: [] })
  radiantBans!: number[];

  @Prop({ type: [Number], default: [] })
  direBans!: number[];

  /**
   * The scoreboard exactly as Valve sent it — **only on the first snapshot of
   * each match**.
   *
   * It is 91% of a document's size and its shape does not change within a
   * match, so one copy per match is enough to re-extract a field later, at a
   * tenth of the storage. Valve has already removed `server_steam_id` from
   * this feed once; without any raw copy, a field nobody thought to extract
   * would be unrecoverable.
   */
  @Prop({ type: Object })
  raw?: Record<string, unknown>;
}

export type MatchSnapshotDocument = HydratedDocument<MatchSnapshot>;
export const MatchSnapshotSchema = SchemaFactory.createForClass(MatchSnapshot);

/**
 * One snapshot per match per poll. Unique so a retried write cannot double up,
 * and compound so "this match, in order" is an index scan.
 */
MatchSnapshotSchema.index({ matchId: 1, capturedAt: 1 }, { unique: true });
