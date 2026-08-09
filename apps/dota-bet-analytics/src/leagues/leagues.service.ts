import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Model } from 'mongoose';

import { HttpObserver } from '../common/http-observer.js';
import { fetchJson } from '../common/http.js';
import type { Env } from '../config/env.schema.js';
import { AppLogger } from '../logger/logger.service.js';
import { League } from './league.schema.js';

interface OpenDotaLeague {
  leagueid: number;
  name: string;
  tier?: string;
}

interface PrizePoolResponse {
  result?: { prize_pool?: number; status?: number };
}

/** Whether a league is worth tracking, and what it is called. */
export interface LeagueDecision {
  tracked: boolean;
  name?: string;
}

/** Prize pools barely move once an event is announced. */
const PRIZE_POOL_TTL_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class LeaguesService implements OnModuleInit {
  constructor(
    @InjectModel(League.name) private readonly leagueModel: Model<League>,
    private readonly config: ConfigService<Env, true>,
    private readonly http: HttpObserver,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit() {
    if ((await this.leagueModel.estimatedDocumentCount()) === 0) {
      await this.sync();
    }
  }

  /** New leagues appear constantly, and tiers get reclassified. */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async scheduledSync() {
    await this.sync();
  }

  /**
   * Whether a league is worth tracking, by prize money — and its name.
   *
   * Looked up from Valve the first time a league appears and cached, so the
   * cost is one call per new tournament rather than one per poll. A league we
   * cannot price is not tracked — better to miss an event than to fill the
   * archive with pickup games.
   *
   * The name rides along because the caller needs both and this already loads
   * the whole row. Asking twice would double the queries on every poll for a
   * field that is sitting in the document it just read.
   */
  async resolve(leagueId: number): Promise<LeagueDecision> {
    const minimum = this.config.get('MIN_PRIZE_POOL', { infer: true });
    const league = await this.leagueModel.findOne({ leagueId }).lean<League>().exec();
    /* `sync` writes the id as a placeholder name for leagues OpenDota has not
       named yet. Treated as absent so the console can fall back rather than
       print a number twice. */
    const name = league?.name && league.name !== String(leagueId) ? league.name.trim() : undefined;

    const fresh =
      league?.prizePoolAt &&
      Date.now() - new Date(league.prizePoolAt).getTime() < PRIZE_POOL_TTL_MS;

    if (fresh) {
      return { tracked: (league.prizePool ?? 0) >= minimum, name };
    }

    const prizePool = await this.fetchPrizePool(leagueId);
    if (prizePool === null) {
      /* Valve did not answer. Fall back to whatever we knew rather than
         dropping a tournament because one request failed. */
      return { tracked: (league?.prizePool ?? 0) >= minimum, name };
    }

    await this.leagueModel.updateOne(
      { leagueId },
      {
        $set: { leagueId, prizePool, prizePoolAt: new Date() },
        $setOnInsert: { name: String(leagueId) },
      },
      { upsert: true },
    );

    return { tracked: prizePool >= minimum, name };
  }

  /** Dollars, or null when Valve could not be reached. */
  private async fetchPrizePool(leagueId: number): Promise<number | null> {
    const key = this.config.get('STEAM_API_KEY', { infer: true });
    try {
      const body = await fetchJson<PrizePoolResponse>(
        `https://api.steampowered.com/IEconDOTA2_570/GetTournamentPrizePool/v1/?key=${key}&leagueid=${leagueId}`,
        { observer: this.http.for('steam'), retries: 1 },
      );
      return body.result?.prize_pool ?? 0;
    } catch (error) {
      this.logger.warn('prize pool lookup failed', {
        context: 'Leagues',
        leagueId,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async findByLeagueId(leagueId: number): Promise<League | null> {
    return this.leagueModel.findOne({ leagueId }).lean<League>().exec();
  }

  async sync(): Promise<number> {
    const baseUrl = this.config.get('OPENDOTA_API_URL', { infer: true });
    const leagues = await fetchJson<OpenDotaLeague[]>(`${baseUrl}/leagues`, {
      timeoutMs: 30_000,
      observer: this.http.for('opendota'),
    });

    if (leagues.length === 0) {
      this.logger.warn('OpenDota returned no leagues, keeping existing list', {
        context: 'Leagues',
      });
      return 0;
    }

    await this.leagueModel.bulkWrite(
      leagues.map((league) => ({
        updateOne: {
          filter: { leagueId: league.leagueid },
          update: {
            $set: {
              leagueId: league.leagueid,
              name: league.name ?? String(league.leagueid),
              ...(league.tier ? { tier: league.tier } : {}),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    /* Prize pools are looked up lazily as leagues appear in the feed, so this
       counts what we have priced so far rather than what is trackable. */
    const priced = await this.leagueModel.countDocuments({
      prizePool: { $gte: this.config.get('MIN_PRIZE_POOL', { infer: true }) },
    });
    this.logger.log('leagues synced', { context: 'Leagues', count: leagues.length, priced });
    return leagues.length;
  }
}
