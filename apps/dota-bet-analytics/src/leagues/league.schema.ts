import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** OpenDota's tier values, in the order they rank. */
export const LEAGUE_TIERS = ['premium', 'professional', 'excluded', 'amateur'] as const;
export type LeagueTier = (typeof LEAGUE_TIERS)[number];

/**
 * Tiers this app tracks. `premium` is tier 1, `professional` is tier 2.
 *
 * This is the entire filter between a usable feed and noise: a sample of the
 * live league feed held 49 matches, 47 of them amateur.
 */
export const TRACKED_TIERS: readonly LeagueTier[] = ['premium', 'professional'];

/**
 * A Dota league, synced from OpenDota.
 *
 * Valve's live feed carries no tier, so this collection is what makes tier
 * filtering possible at all.
 */
@Schema({ collection: 'leagues', timestamps: true })
export class League {
  @Prop({ required: true, unique: true, index: true })
  leagueId!: number;

  @Prop({ required: true })
  name!: string;

  /** Absent for a handful of leagues OpenDota has not classified. */
  @Prop({ index: true })
  tier?: string;
}

export type LeagueDocument = HydratedDocument<League>;
export const LeagueSchema = SchemaFactory.createForClass(League);
