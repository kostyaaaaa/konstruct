import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Model } from 'mongoose';

import { AppLogger } from '../logger/logger.service.js';
import { OpenDotaService } from '../opendota/opendota.service.js';
import { ProPlayer } from './pro-player.schema.js';

@Injectable()
export class ProPlayersService implements OnModuleInit {
  /** Held while a sync runs, so concurrent callers await one request. */
  private inFlight: Promise<number> | null = null;

  constructor(
    @InjectModel(ProPlayer.name) private readonly model: Model<ProPlayer>,
    private readonly openDota: OpenDotaService,
    private readonly logger: AppLogger,
  ) {}

  /** Seed on boot, but only when the collection is empty. */
  async onModuleInit() {
    if ((await this.model.estimatedDocumentCount()) === 0) {
      await this.sync();
    }
  }

  /**
   * Daily is enough. Rosters move between seasons, not between matches, and
   * the list is thousands of players in one response — not something to fetch
   * per prediction.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledSync() {
    await this.sync();
  }

  /**
   * The competitive nickname for an account, or null.
   *
   * Null is the normal answer for most accounts: only registered professionals
   * are in the list, and a tier 2 league has players who are not.
   */
  async nameFor(accountId: number): Promise<string | null> {
    if (accountId === 0) {
      return null;
    }
    const player = await this.model.findOne({ accountId }).lean<ProPlayer>().exec();
    return player?.name ?? null;
  }

  async sync(): Promise<number> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.runSync().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async runSync(): Promise<number> {
    const players = await this.openDota.proPlayers();

    /* A player with no nickname is not worth a row — the fallback to the Steam
       persona handles them, and storing an empty name would shadow it. */
    const named = players.filter((player) => player.account_id && player.name?.trim());

    if (named.length === 0) {
      // Never let an empty response wipe a good list.
      this.logger.warn('proPlayers returned nothing usable, keeping existing list', {
        context: 'ProPlayers',
      });
      return 0;
    }

    await this.model.bulkWrite(
      named.map((player) => ({
        updateOne: {
          filter: { accountId: player.account_id },
          update: {
            $set: {
              accountId: player.account_id,
              name: player.name!.trim(),
              teamName: player.team_name,
            },
          },
          upsert: true,
        },
      })),
    );

    this.logger.log('pro players synced', { context: 'ProPlayers', count: named.length });
    return named.length;
  }
}
