import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * One player as they were at the moment of the prediction.
 *
 * The old app computed all of this, rendered it into an email, and discarded
 * it — only the two final numbers were stored. That made a past prediction
 * impossible to rebuild anywhere except in the inbox. It is all kept now.
 */
@Schema({ _id: false })
export class PredictionPlayer {
  @Prop({ required: true })
  accountId!: number;

  /** Steam display name — whatever the account is called. Often not the
      name the player is known by. */
  @Prop()
  personaName?: string;

  /** The competitive nickname, when the account is a registered professional.
      Absent for everyone else, which is normal in a tier 2 league. */
  @Prop()
  proName?: string;

  @Prop({ required: true })
  heroId!: number;

  @Prop()
  heroName?: string;

  @Prop()
  heroImageUrl?: string;

  /** Win rate on this hero at prediction time, 0-100. Null if never played. */
  @Prop({ type: Number, default: null })
  winRate!: number | null;

  /** 1-based position in the player's most-played list. Null if never played. */
  @Prop({ type: Number, default: null })
  heroRank!: number | null;

  @Prop({ default: 0 })
  gamesOnHero!: number;

  /** Wins on this hero. A percentage alone cannot be shrunk toward even. */
  @Prop({ default: 0 })
  winsOnHero!: number;

  @Prop()
  leaderboardRank?: number;

  /** True when the stats could not be fetched — absent for a real reason. */
  @Prop({ default: false })
  missing!: boolean;
}

export const PredictionPlayerSchema = SchemaFactory.createForClass(PredictionPlayer);

@Schema({ collection: 'predictions', timestamps: true })
export class Prediction {
  @Prop({ required: true, unique: true, index: true })
  matchId!: number;

  @Prop({ required: true, index: true })
  leagueId!: number;

  @Prop()
  leagueName?: string;

  /**
   * OpenDota's tier for the league, recorded at prediction time.
   *
   * Context only — leagues are chosen by prize money, not by this. It is kept
   * because it is what the model was fitted against, so it stays useful if the
   * question of population ever comes back.
   */
  @Prop({ index: true })
  leagueTier?: string;

  @Prop()
  radiantTeamName?: string;

  @Prop()
  direTeamName?: string;

  /**
   * The broadcast delay on this match, in seconds, as Valve reported it.
   *
   * Stored because it says how stale the prediction already was when it was
   * made: the scoreboard arrives on the delayed timeline, so a 900-second
   * league gives us the draft a quarter of an hour after it happened.
   */
  @Prop()
  streamDelaySeconds?: number;

  @Prop({ required: true })
  radiantScore!: number;

  @Prop({ required: true })
  direScore!: number;

  /** `radiant`, `dire`, or null when the two scores are equal. */
  @Prop({ type: String, default: null })
  favoured!: string | null;

  @Prop({ default: 0 })
  margin!: number;

  /** The gap between the two scores, as a share of the larger one. */
  @Prop({ default: 0 })
  marginPercent!: number;

  /** The draft advantage each side had, 0-100. 50 is an even draft. */
  @Prop()
  radiantMatchup?: number;

  @Prop()
  direMatchup?: number;

  /**
   * Which model produced this row.
   *
   * `marginPercent` means something different under the probability model than
   * it did under the old two-score formula. Averaging accuracy across both
   * would silently mix two scales, so every query that compares predictions
   * filters on this.
   */
  @Prop({ default: 1, index: true })
  modelVersion!: number;

  @Prop({ type: [PredictionPlayerSchema], default: [] })
  radiantPlayers!: PredictionPlayer[];

  @Prop({ type: [PredictionPlayerSchema], default: [] })
  direPlayers!: PredictionPlayer[];

  /**
   * False when any player's stats could not be fetched. The prediction is
   * still stored — it is real, just built on less — but accuracy work must be
   * able to exclude it rather than treat a gap as a genuine zero.
   */
  @Prop({ default: true })
  complete!: boolean;

  /**
   * True when two or more players on either side had fewer than five games on
   * the hero they picked.
   *
   * Separate from `complete`, and not a worse version of it. `complete` means
   * a fetch failed — we have no data. This means the fetch worked and the data
   * it returned is too thin to say anything, which usually means the account
   * is new and the player's real history is on another one.
   *
   * The prediction is made either way. This exists so accuracy can be measured
   * with those matches left out, which is the only way to find out whether
   * they are actually worse.
   */
  @Prop({ default: false, index: true })
  suspicious!: boolean;

  /** Filled in after the match, from OpenDota. Empty until then. */
  @Prop({ type: String, default: null, index: true })
  winner!: string | null;

  /** Whether `favoured` matched `winner`. Null until the winner is known. */
  @Prop({ type: Boolean, default: null })
  correct!: boolean | null;

  /**
   * How many times backfill has asked OpenDota for the result.
   *
   * A match is not parsed the moment it ends, so the first few attempts
   * normally find nothing. Counting them lets backfill give up on a match that
   * will never resolve instead of asking forever and spending the daily quota
   * on it.
   */
  @Prop({ default: 0 })
  backfillAttempts!: number;

  @Prop()
  lastBackfillAt?: Date;
}

export type PredictionDocument = HydratedDocument<Prediction>;
export const PredictionSchema = SchemaFactory.createForClass(Prediction);
