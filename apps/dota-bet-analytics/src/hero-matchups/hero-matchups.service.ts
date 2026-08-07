import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Model } from 'mongoose';

import { AppLogger } from '../logger/logger.service.js';
import { OpenDotaService } from '../opendota/opendota.service.js';
import { HeroMatchup, type VersusRecord } from './hero-matchup.schema.js';

interface WinRow {
  hero: number;
  versus: number;
  wins: number;
}

/**
 * A pairing that has never happened. Not zero — zero would read as "this hero
 * always loses to that one", which is the opposite of "we have no idea".
 */
const UNKNOWN_MATCHUP = 50;

const FROM_UNIX = Math.floor(Date.parse('2023-01-01T00:00:00Z') / 1000);
const WINDOW_SECONDS = 182 * 24 * 3600;

@Injectable()
export class HeroMatchupsService implements OnModuleInit {
  private syncing = false;

  constructor(
    @InjectModel(HeroMatchup.name) private readonly model: Model<HeroMatchup>,
    private readonly openDota: OpenDotaService,
    private readonly logger: AppLogger,
  ) {}

  /** Seeded in the background, for the same reason as team ratings. */
  async onModuleInit() {
    if ((await this.model.estimatedDocumentCount()) > 0) {
      return;
    }

    this.logger.log('hero matchups empty, seeding in the background', { context: 'HeroMatchups' });
    void this.sync().catch((error: unknown) => {
      this.logger.error('hero matchup seed failed', error instanceof Error ? error : undefined, {
        context: 'HeroMatchups',
      });
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async scheduledSync() {
    await this.sync();
  }

  /**
   * How one side's heroes have historically fared against the other's.
   *
   * The mean win rate of each of our heroes against each of theirs, then
   * averaged — so 50 means an even draft and the number reads as a percentage.
   */
  async matchupFor(ourHeroes: readonly number[], theirHeroes: readonly number[]): Promise<number> {
    if (ourHeroes.length === 0 || theirHeroes.length === 0) {
      return 50;
    }

    const rows = await this.model
      .find({ heroId: { $in: [...ourHeroes] } })
      .select('heroId versus -_id')
      .lean<{ heroId: number; versus: Record<string, VersusRecord> }[]>()
      .exec();

    const byHero = new Map(rows.map((r) => [r.heroId, r.versus]));

    let total = 0;
    for (const ours of ourHeroes) {
      const versus = byHero.get(ours) ?? {};
      let against = 0;
      for (const theirs of theirHeroes) {
        const record = versus[String(theirs)];
        const games = record?.games ?? 0;
        /* The real percentage, not a smoothed one: a matchup is meant to be
           read as "this hero beats that one X% of the time". The median pair
           has ~115 games behind it, so thin cells are rare. */
        against += games > 0 ? ((record?.wins ?? 0) / games) * 100 : UNKNOWN_MATCHUP;
      }
      total += against / theirHeroes.length;
    }

    return Number((total / ourHeroes.length).toFixed(2));
  }

  /**
   * Rebuilds the whole matrix.
   *
   * Unlike team ratings this is not path-dependent — it is a count, so the
   * order matches were played does not matter and the database can do the
   * counting. One window at a time: the self-join over three years at once
   * exceeds OpenDota's query timeout.
   */
  async sync(): Promise<number> {
    if (this.syncing) {
      this.logger.warn('hero matchup sync already running, skipping', { context: 'HeroMatchups' });
      return 0;
    }

    this.syncing = true;
    try {
      const wins = new Map<number, Map<number, number>>();
      const now = Math.floor(Date.now() / 1000);
      let counted = 0;

      for (let start = FROM_UNIX; start < now; start += WINDOW_SECONDS) {
        const rows = await this.openDota.explorer<WinRow>(`
          SELECT w.hero_id AS hero, l.hero_id AS versus, count(*)::int AS wins
          FROM matches m
          JOIN leagues lg ON lg.leagueid = m.leagueid
          JOIN player_matches w ON w.match_id = m.match_id
          JOIN player_matches l ON l.match_id = m.match_id
          WHERE lg.tier IN ('premium', 'professional')
            AND m.radiant_win IS NOT NULL
            AND m.start_time >= ${start} AND m.start_time < ${start + WINDOW_SECONDS}
            AND (m.radiant_win = (w.player_slot < 128))
            AND (m.radiant_win = (l.player_slot >= 128))
          GROUP BY 1, 2
        `);

        for (const row of rows) {
          if (!wins.has(row.hero)) {
            wins.set(row.hero, new Map());
          }
          const cell = wins.get(row.hero)!;
          cell.set(row.versus, (cell.get(row.versus) ?? 0) + row.wins);
          counted += row.wins;
        }
      }

      if (wins.size === 0) {
        // Never let an empty answer wipe a good matrix.
        this.logger.warn('no matchups returned, keeping existing matrix', {
          context: 'HeroMatchups',
        });
        return 0;
      }

      /* `games` is not in the query: a pair's total is simply the times each
         side won, and asking the database for it would double the work. */
      const documents = [...wins.entries()].map(([heroId, against]) => {
        const versus: Record<string, VersusRecord> = {};
        for (const [other, won] of against) {
          const lost = wins.get(other)?.get(heroId) ?? 0;
          versus[String(other)] = { wins: won, games: won + lost };
        }
        return { heroId, versus };
      });

      await this.model.bulkWrite(
        documents.map((d) => ({
          updateOne: { filter: { heroId: d.heroId }, update: { $set: d }, upsert: true },
        })),
      );

      this.logger.log('hero matchups rebuilt', {
        context: 'HeroMatchups',
        heroes: documents.length,
        pairings: counted,
      });
      return documents.length;
    } finally {
      this.syncing = false;
    }
  }
}
