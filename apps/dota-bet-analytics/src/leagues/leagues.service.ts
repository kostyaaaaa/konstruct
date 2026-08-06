import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Model } from 'mongoose';

import { HttpObserver } from '../common/http-observer.js';
import { fetchJson } from '../common/http.js';
import type { Env } from '../config/env.schema.js';
import { AppLogger } from '../logger/logger.service.js';
import { League, TRACKED_TIERS } from './league.schema.js';

interface OpenDotaLeague {
  leagueid: number;
  name: string;
  tier?: string;
}

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

  /** The ids worth tracking, for filtering the live feed. */
  async trackedLeagueIds(): Promise<Set<number>> {
    const leagues = await this.leagueModel
      .find({ tier: { $in: TRACKED_TIERS } })
      .select('leagueId')
      .lean<{ leagueId: number }[]>()
      .exec();

    return new Set(leagues.map((league) => league.leagueId));
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

    const tracked = await this.leagueModel.countDocuments({ tier: { $in: TRACKED_TIERS } });
    this.logger.log('leagues synced', { context: 'Leagues', count: leagues.length, tracked });
    return leagues.length;
  }
}
