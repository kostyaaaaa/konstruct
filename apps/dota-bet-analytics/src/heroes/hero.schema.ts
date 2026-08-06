import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * A Dota hero, synced from Steam.
 *
 * This replaces the hand-maintained list the old app carried. Valve adds
 * heroes every few patches, and a static file silently produces an unknown
 * hero the day that happens.
 */
@Schema({ collection: 'heroes', timestamps: true })
export class Hero {
  /** Valve's hero id, as it appears in match payloads. */
  @Prop({ required: true, unique: true, index: true })
  heroId!: number;

  /** Internal name, e.g. `npc_dota_hero_antimage`. */
  @Prop({ required: true })
  name!: string;

  /** Display name, e.g. `Anti-Mage`. */
  @Prop({ required: true })
  localizedName!: string;

  /**
   * Portrait URL. Derived from `name`, not returned by Steam — `GetHeroes`
   * has no image field, so it is built from the slug.
   */
  @Prop({ required: true })
  imageUrl!: string;
}

export type HeroDocument = HydratedDocument<Hero>;
export const HeroSchema = SchemaFactory.createForClass(Hero);

/** `npc_dota_hero_antimage` -> the CDN portrait for `antimage`. */
export function heroImageUrl(name: string): string {
  const slug = name.replace(/^npc_dota_hero_/, '');
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`;
}
