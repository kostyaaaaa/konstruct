import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * A registered professional player, synced from OpenDota.
 *
 * Exists so a roster can show the name a player is known by on broadcast.
 * The name attached to a live match is the Steam persona — whatever the
 * account happens to be called that week — which is why a roster otherwise
 * reads `failure` and `Ankou ♡` instead of the names in the casting.
 */
@Schema({ collection: 'pro_players', timestamps: true })
export class ProPlayer {
  @Prop({ required: true, unique: true, index: true })
  accountId!: number;

  /** The competitive nickname. This is the whole point of the collection. */
  @Prop({ required: true })
  name!: string;

  @Prop()
  teamName?: string;
}

export type ProPlayerDocument = HydratedDocument<ProPlayer>;
export const ProPlayerSchema = SchemaFactory.createForClass(ProPlayer);
