import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { HttpObserver } from '../common/http-observer.js';
import { fetchJson } from '../common/http.js';
import type { Env } from '../config/env.schema.js';
import { AppLogger } from '../logger/logger.service.js';
import { Hero, heroImageUrl } from './hero.schema.js';

interface SteamHeroesResponse {
  result?: { heroes?: { id: number; name: string; localized_name: string }[] };
}

/** How long to wait before an unknown hero may trigger another sync. */
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

@Injectable()
export class HeroesService implements OnModuleInit {
  private lastRefreshAt = 0;
  /** Held while a sync is running, so concurrent callers await one request. */
  private inFlight: Promise<number> | null = null;

  constructor(
    @InjectModel(Hero.name) private readonly heroModel: Model<Hero>,
    private readonly config: ConfigService<Env, true>,
    private readonly http: HttpObserver,
    private readonly logger: AppLogger,
  ) {}

  /** Seed on boot, but only when the collection is empty. */
  async onModuleInit() {
    if ((await this.heroModel.estimatedDocumentCount()) === 0) {
      await this.sync();
    }
  }

  /** Valve adds heroes on a patch, so re-sync daily regardless. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync() {
    await this.sync();
  }

  async findByHeroId(heroId: number): Promise<Hero | null> {
    const hero = await this.heroModel.findOne({ heroId }).lean<Hero>().exec();
    if (hero) return hero;

    // Unknown id: most likely a hero added in a patch we have not synced.
    const refreshed = await this.refreshForUnknownHero(heroId);
    if (!refreshed) return null;

    const retried = await this.heroModel.findOne({ heroId }).lean<Hero>().exec();
    if (!retried) {
      this.logger.warn('hero still unknown after sync', { context: 'Heroes', heroId });
    }
    return retried;
  }

  /**
   * Syncs, but at most once per cooldown and never twice at the same time.
   *
   * Both guards matter: a match has ten heroes, so one genuinely bad id would
   * otherwise fire ten syncs at once, and would keep doing it on every poll.
   */
  private async refreshForUnknownHero(heroId: number): Promise<boolean> {
    if (this.inFlight) {
      await this.inFlight;
      return true;
    }

    if (Date.now() - this.lastRefreshAt < REFRESH_COOLDOWN_MS) {
      return false;
    }

    this.logger.log('unknown hero, syncing hero list', { context: 'Heroes', heroId });
    await this.sync();
    return true;
  }

  /** Fetches every hero from Steam and upserts them. Returns how many. */
  async sync(): Promise<number> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.runSync().finally(() => {
      this.inFlight = null;
      this.lastRefreshAt = Date.now();
    });

    return this.inFlight;
  }

  private async runSync(): Promise<number> {
    const key = this.config.get('STEAM_API_KEY', { infer: true });
    const url = `https://api.steampowered.com/IEconDOTA2_570/GetHeroes/v1/?key=${key}&language=en`;

    const payload = await fetchJson<SteamHeroesResponse>(url, {
      observer: this.http.for('steam'),
    });
    const heroes = payload.result?.heroes ?? [];

    if (heroes.length === 0) {
      // Never let an empty response wipe a good list.
      this.logger.warn('GetHeroes returned no heroes, keeping existing list', {
        context: 'Heroes',
      });
      return 0;
    }

    await this.heroModel.bulkWrite(
      heroes.map((hero) => ({
        updateOne: {
          filter: { heroId: hero.id },
          update: {
            $set: {
              heroId: hero.id,
              name: hero.name,
              localizedName: hero.localized_name,
              imageUrl: heroImageUrl(hero.name),
            },
          },
          upsert: true,
        },
      })),
    );

    this.logger.log('heroes synced', { context: 'Heroes', count: heroes.length });
    return heroes.length;
  }
}
