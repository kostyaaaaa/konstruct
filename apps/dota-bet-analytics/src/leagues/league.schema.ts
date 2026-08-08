import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** OpenDota's tier values, in the order they rank. */
export const LEAGUE_TIERS = ['premium', 'professional', 'excluded', 'amateur'] as const;
export type LeagueTier = (typeof LEAGUE_TIERS)[number];

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

  /**
   * Prize pool in dollars, from Valve.
   *
   * **This is the filter.** Valve does not classify tournaments at all, so
   * prize money is the closest thing to an objective statement about how
   * serious an event is — and unlike a label it cannot be applied
   * inconsistently. Measured across one evening's live feed, every tournament
   * with money was one worth tracking and every one without was a pickup
   * league: FACEIT, RetosDota2, Kobold League and nine others, all at zero.
   *
   * Undefined means never looked up; 0 means Valve says there is none.
   */
  @Prop({ index: true })
  prizePool?: number;

  /** When the prize pool was last fetched, so it can be refreshed. */
  @Prop()
  prizePoolAt?: Date;
}

export type LeagueDocument = HydratedDocument<League>;
export const LeagueSchema = SchemaFactory.createForClass(League);
