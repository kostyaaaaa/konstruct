import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** How one hero has fared against another. */
export interface VersusRecord {
  wins: number;
  games: number;
}

/**
 * One row per hero, holding its record against every other hero.
 *
 * Nested rather than one document per pair: there are ~16,000 pairs but only
 * ~126 heroes, and a prediction needs five heroes' full records at once. Five
 * documents is one query; 630 pair documents is the same data in a much worse
 * shape.
 */
@Schema({ collection: 'hero_matchups', timestamps: true })
export class HeroMatchup {
  @Prop({ required: true, unique: true, index: true })
  heroId!: number;

  /** Keyed by opponent hero id, as a string because that is what BSON allows. */
  @Prop({ type: Object, default: {} })
  versus!: Record<string, VersusRecord>;
}

export type HeroMatchupDocument = HydratedDocument<HeroMatchup>;
export const HeroMatchupSchema = SchemaFactory.createForClass(HeroMatchup);
