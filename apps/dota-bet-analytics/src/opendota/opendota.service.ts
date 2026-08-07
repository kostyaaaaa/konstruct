import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HttpObserver } from '../common/http-observer.js';
import { fetchJson } from '../common/http.js';
import type { Env } from '../config/env.schema.js';

interface OpenDotaPlayerHero {
  hero_id: number | string;
  games: number;
  win: number;
}

interface OpenDotaPlayer {
  profile?: { personaname?: string; avatarfull?: string };
  rank_tier?: number;
  leaderboard_rank?: number;
}

export interface PlayerProfile {
  accountId: number;
  personaName?: string;
  avatarUrl?: string;
  rankTier?: number;
  leaderboardRank?: number;
}

export interface PlayerHeroRecord {
  /** 1-based rank in the most-played list, or null if never played. */
  heroRank: number | null;
  games: number;
  wins: number;
  winRate: number | null;
}

/** Only the fields used; the endpoint returns many more. */
export interface OpenDotaProPlayer {
  account_id?: number;
  /** The competitive nickname, e.g. `Yatoro`. */
  name?: string;
  team_name?: string;
}

@Injectable()
export class OpenDotaService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly http: HttpObserver,
  ) {}

  private get observer() {
    return this.http.for('opendota');
  }

  private get baseUrl() {
    return this.config.get('OPENDOTA_API_URL', { infer: true });
  }

  /**
   * Runs read-only SQL against OpenDota's own database.
   *
   * The REST API cannot answer "every professional match since 2023 with its
   * result" without tens of thousands of calls. This answers it in one, which
   * is what makes rebuilding team ratings from history practical.
   *
   * A long timeout: these are real queries over a large table, not lookups.
   */
  async explorer<T>(sql: string): Promise<T[]> {
    const url = `https://api.opendota.com/api/explorer?sql=${encodeURIComponent(sql)}`;
    const body = await fetchJson<{ rows?: T[]; err?: unknown }>(url, {
      observer: this.observer,
      timeoutMs: 180_000,
      /* A malformed query fails the same way every time; retrying it only
         spends someone else's database. */
      retries: 1,
    });

    if (body.err) {
      throw new Error(
        `OpenDota explorer rejected the query: ${JSON.stringify(body.err).slice(0, 200)}`,
      );
    }
    return body.rows ?? [];
  }

  /**
   * Every registered professional player.
   *
   * One large response — thousands of rows — so it is synced on a schedule
   * into `pro_players` rather than called per prediction.
   */
  async proPlayers(): Promise<OpenDotaProPlayer[]> {
    return fetchJson<OpenDotaProPlayer[]>(`${this.baseUrl}/proPlayers`, {
      observer: this.observer,
      /* The list is far bigger than any other call here, so it gets longer
         than the 10s default before an attempt is abandoned. */
      timeoutMs: 30_000,
    });
  }

  async matchDetail(matchId: number): Promise<{ radiant_win?: boolean } | null> {
    return fetchJson<{ radiant_win?: boolean }>(`${this.baseUrl}/matches/${matchId}`, {
      observer: this.observer,
    });
  }

  async playerProfile(accountId: number): Promise<PlayerProfile> {
    const player = await fetchJson<OpenDotaPlayer>(`${this.baseUrl}/players/${accountId}`, {
      observer: this.observer,
    });
    return {
      accountId,
      personaName: player.profile?.personaname,
      avatarUrl: player.profile?.avatarfull,
      rankTier: player.rank_tier,
      leaderboardRank: player.leaderboard_rank,
    };
  }

  /**
   * How this player performs on this hero.
   *
   * OpenDota returns the full hero list ordered by games played, so the index
   * is the familiarity rank. A hero they have never picked is absent, which is
   * information rather than an error — it is reported as `heroRank: null`
   * instead of being turned into a zero.
   */
  async playerHero(accountId: number, heroId: number): Promise<PlayerHeroRecord> {
    const rows = await fetchJson<OpenDotaPlayerHero[]>(
      `${this.baseUrl}/players/${accountId}/heroes`,
      { observer: this.observer },
    );

    const index = rows.findIndex((row) => Number(row.hero_id) === heroId);
    const row = index >= 0 ? rows[index] : undefined;

    if (!row || row.games === 0) {
      return { heroRank: null, games: 0, wins: 0, winRate: null };
    }

    return {
      heroRank: index + 1,
      games: row.games,
      wins: row.win,
      winRate: Number(((row.win / row.games) * 100).toFixed(2)),
    };
  }
}
