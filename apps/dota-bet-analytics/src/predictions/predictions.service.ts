import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { mapWithLimit } from '../common/concurrency.js';
import type { SteamLiveGame, SteamScoreboardSide } from '../discovery/steam.types.js';
import { HeroesService } from '../heroes/heroes.service.js';
import { AppLogger } from '../logger/logger.service.js';
import { OpenDotaService } from '../opendota/opendota.service.js';
import { ProPlayersService } from '../pro-players/pro-players.service.js';
import { Prediction, type PredictionPlayer } from './prediction.schema.js';
import { pick, scoreSide, type PlayerHeroStats } from './scoring.js';

/** OpenDota's free tier allows 60 requests a minute; ten players cost twenty. */
const OPENDOTA_CONCURRENCY = 3;

export interface PredictionContext {
  matchId: number;
  leagueId: number;
  leagueName?: string;
  radiantTeamName?: string;
  direTeamName?: string;
  streamDelaySeconds?: number;
}

@Injectable()
export class PredictionsService {
  constructor(
    @InjectModel(Prediction.name) private readonly model: Model<Prediction>,
    private readonly openDota: OpenDotaService,
    private readonly heroes: HeroesService,
    private readonly proPlayers: ProPlayersService,
    private readonly logger: AppLogger,
  ) {}

  async existsFor(matchId: number): Promise<boolean> {
    return (await this.model.countDocuments({ matchId })) > 0;
  }

  /**
   * Scores a match and stores the whole payload.
   *
   * Returns null when the game has no draft yet — a prediction before heroes
   * are picked would be meaningless.
   */
  async analyse(game: SteamLiveGame, context: PredictionContext): Promise<Prediction | null> {
    const radiantSide = game.scoreboard?.radiant;
    const direSide = game.scoreboard?.dire;

    if (!this.hasDraft(radiantSide) || !this.hasDraft(direSide)) {
      return null;
    }

    const [radiantPlayers, direPlayers] = await Promise.all([
      this.buildPlayers(radiantSide),
      this.buildPlayers(direSide),
    ]);

    const radiant = scoreSide(radiantPlayers.map(toStats));
    const dire = scoreSide(direPlayers.map(toStats));
    const outcome = pick(radiant.score, dire.score);

    const complete = [...radiantPlayers, ...direPlayers].every((player) => !player.missing);
    if (!complete) {
      const missing = [...radiantPlayers, ...direPlayers].filter((p) => p.missing).length;
      this.logger.warn('prediction built on incomplete player stats', {
        context: 'Predictions',
        matchId: context.matchId,
        missingPlayers: missing,
      });
    }

    const prediction = await this.model
      .findOneAndUpdate(
        { matchId: context.matchId },
        {
          $set: {
            ...context,
            radiantScore: radiant.score,
            direScore: dire.score,
            favoured: outcome.favoured,
            margin: outcome.margin,
            marginPercent: outcome.marginPercent,
            radiantPlayers,
            direPlayers,
            complete,
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .lean<Prediction>()
      .exec();

    this.logger.log('prediction made', {
      context: 'Predictions',
      matchId: context.matchId,
      radiant: context.radiantTeamName,
      dire: context.direTeamName,
      radiantScore: radiant.score,
      direScore: dire.score,
      favoured: outcome.favoured,
      marginPercent: outcome.marginPercent,
      complete,
    });

    return prediction;
  }

  /** A side with five picks has drafted. */
  private hasDraft(side: SteamScoreboardSide | undefined): boolean {
    return (side?.players ?? []).some((player) => (player.hero_id ?? 0) > 0);
  }

  private async buildPlayers(side: SteamScoreboardSide | undefined): Promise<PredictionPlayer[]> {
    const players = (side?.players ?? []).filter((player) => (player.hero_id ?? 0) > 0);

    return mapWithLimit(players, OPENDOTA_CONCURRENCY, async (player) => {
      const accountId = player.account_id ?? 0;
      const heroId = player.hero_id ?? 0;
      const [hero, proName] = await Promise.all([
        this.heroes.findByHeroId(heroId),
        this.proPlayers.nameFor(accountId),
      ]);

      const base: PredictionPlayer = {
        accountId,
        proName: proName ?? undefined,
        heroId,
        heroName: hero?.localizedName,
        heroImageUrl: hero?.imageUrl,
        winRate: null,
        heroRank: null,
        gamesOnHero: 0,
        missing: false,
      };

      if (accountId === 0) {
        /* Anonymous profile — real, not a failure. */
        return { ...base, missing: true };
      }

      try {
        const [record, profile] = await Promise.all([
          this.openDota.playerHero(accountId, heroId),
          this.openDota.playerProfile(accountId),
        ]);

        return {
          ...base,
          personaName: profile.personaName,
          leaderboardRank: profile.leaderboardRank,
          winRate: record.winRate,
          heroRank: record.heroRank,
          gamesOnHero: record.games,
        };
      } catch (error) {
        /* Marked rather than swallowed. The old app turned this into a silent
           zero, which is how "0 vs 0" predictions ended up in the database
           looking like real results. */
        this.logger.warn('player stats unavailable', {
          context: 'Predictions',
          accountId,
          heroId,
          reason: error instanceof Error ? error.message : String(error),
        });
        return { ...base, missing: true };
      }
    });
  }

  /**
   * Predictions still waiting on a result, oldest attempt first.
   *
   * `backfillAttempts` caps the retries: a match that never parses would
   * otherwise be asked about forever, and OpenDota's daily budget is small.
   */
  async findAwaitingWinner(limit: number, maxAttempts: number): Promise<Prediction[]> {
    return this.model
      .find({ winner: null, backfillAttempts: { $lt: maxAttempts } })
      .sort({ lastBackfillAt: 1, createdAt: 1 })
      .limit(limit)
      .lean<Prediction[]>()
      .exec();
  }

  /** Records that an attempt happened, whether or not it found anything. */
  async noteBackfillAttempt(matchId: number): Promise<void> {
    await this.model
      .updateOne(
        { matchId },
        { $inc: { backfillAttempts: 1 }, $set: { lastBackfillAt: new Date() } },
      )
      .exec();
  }

  /**
   * Stores the real winner and whether we called it.
   *
   * Correctness compares **sides**, not names: `favoured` is `radiant` or
   * `dire`, while `winner` is a team name for display. Comparing those two
   * directly can never match, and would mark every prediction wrong.
   *
   * A prediction with no favoured side — the two scores were equal — is
   * neither right nor wrong, so `correct` stays null rather than being forced
   * to false.
   */
  async setOutcome(matchId: number, winner: string, radiantWon: boolean): Promise<void> {
    const prediction = await this.model.findOne({ matchId }).select('favoured').lean<{
      favoured: string | null;
    }>();

    const correct = prediction?.favoured
      ? (prediction.favoured === 'radiant') === radiantWon
      : null;

    await this.model
      .updateOne({ matchId }, { $set: { winner, correct, lastBackfillAt: new Date() } })
      .exec();
  }

  async findRecent(limit = 50): Promise<Prediction[]> {
    return this.model.find().sort({ createdAt: -1 }).limit(limit).lean<Prediction[]>().exec();
  }

  async findByMatchId(matchId: number): Promise<Prediction | null> {
    return this.model.findOne({ matchId }).lean<Prediction>().exec();
  }

  /** Accuracy over predictions whose winner is known. */
  async accuracy(minMarginPercent = 0) {
    const settled = await this.model
      .find({ winner: { $ne: null }, complete: true, marginPercent: { $gte: minMarginPercent } })
      .select('correct -_id')
      .lean<{ correct: boolean | null }[]>()
      .exec();

    const correct = settled.filter((row) => row.correct === true).length;

    return {
      minMarginPercent,
      settled: settled.length,
      correct,
      incorrect: settled.length - correct,
      accuracyPercent:
        settled.length > 0 ? Number(((correct / settled.length) * 100).toFixed(1)) : null,
    };
  }
}

function toStats(player: PredictionPlayer): PlayerHeroStats {
  return {
    accountId: player.accountId,
    heroId: player.heroId,
    winRate: player.winRate,
    heroRank: player.heroRank,
    gamesOnHero: player.gamesOnHero,
    missing: player.missing,
  };
}
