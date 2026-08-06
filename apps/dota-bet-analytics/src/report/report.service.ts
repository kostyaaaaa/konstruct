import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';

import { HttpObserver } from '../common/http-observer.js';
import { fetchJson } from '../common/http.js';
import type { Env } from '../config/env.schema.js';
import { AppLogger } from '../logger/logger.service.js';
import type { Prediction, PredictionPlayer } from '../predictions/prediction.schema.js';
import { registerReportHelpers } from './handlebars-helpers.js';

/**
 * The template's own vocabulary.
 *
 * It predates the current data model, and it is 300 lines of hand-written
 * HTML that renders well in mail clients — so the prediction is adapted to it
 * rather than the template being rewritten to match.
 */
interface TemplateHero {
  heroImageLink?: string;
  heroStats: { winrate: number | null; heroIndex: number | null; games: number };
  playerStats: { leaderboard_rank?: number };
}

interface TemplateModel {
  team_name_radiant?: string;
  team_name_dire?: string;
  radiant_score: number;
  dire_score: number;
  radiantStats: number;
  direStats: number;
  currentRadiantHeroes: TemplateHero[];
  currentDireHeroes: TemplateHero[];
}

function toTemplateHero(player: PredictionPlayer): TemplateHero {
  return {
    heroImageLink: player.heroImageUrl,
    heroStats: {
      winrate: player.winRate,
      heroIndex: player.heroRank,
      games: player.gamesOnHero,
    },
    playerStats: { leaderboard_rank: player.leaderboardRank },
  };
}

/** Only the field we use. */
interface ResendResponse {
  id?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

@Injectable()
export class ReportService implements OnModuleInit {
  private template: HandlebarsTemplateDelegate<TemplateModel> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly http: HttpObserver,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit() {
    registerReportHelpers();

    /* Compiled once at startup rather than per send. Reading it here also
       means a missing or broken template fails on boot, not on the first
       match of a tournament. */
    const templatePath = path.resolve(import.meta.dirname, '../templates/dotaReport.hbs');
    const source = await readFile(templatePath, 'utf8');
    this.template = Handlebars.compile<TemplateModel>(source);
  }

  render(prediction: Prediction): string {
    if (!this.template) {
      throw new Error('Report template not compiled');
    }

    return this.template({
      team_name_radiant: prediction.radiantTeamName,
      team_name_dire: prediction.direTeamName,
      radiant_score: 0,
      dire_score: 0,
      radiantStats: prediction.radiantScore,
      direStats: prediction.direScore,
      currentRadiantHeroes: prediction.radiantPlayers.map(toTemplateHero),
      currentDireHeroes: prediction.direPlayers.map(toTemplateHero),
    });
  }

  /**
   * Emails one prediction, through Resend's HTTP API.
   *
   * **Not SMTP, and it cannot be.** Railway allows outbound SMTP on Pro and
   * above only; on Hobby the ports are firewalled, so a mail server is simply
   * unreachable no matter how the credentials are set. An HTTPS API is the
   * supported way out, and it is ordinary traffic on 443.
   *
   * Returns whether it was sent. A failure is logged, never thrown: the
   * prediction is already stored and visible in the console, and losing the
   * archive because a mail provider was down would be the worse outcome.
   */
  async send(prediction: Prediction): Promise<boolean> {
    try {
      const response = await fetchJson<ResendResponse>(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.get('RESEND_API_KEY', { infer: true })}`,
          /* One prediction per match, so the match id is the natural key.
             Without it a retried request — the first may have been carried
             out before it timed out — sends the report twice. */
          'idempotency-key': `prediction-${prediction.matchId}`,
        },
        body: {
          from: this.config.get('REPORT_FROM', { infer: true }),
          to: this.config.get('EMAIL', { infer: true }),
          subject: `${prediction.radiantTeamName ?? 'Radiant'} vs ${prediction.direTeamName ?? 'Dire'}`,
          html: this.render(prediction),
        },
        observer: this.http.for('resend'),
      });

      this.logger.log('report sent', {
        context: 'Report',
        matchId: prediction.matchId,
        messageId: response.id,
      });
      return true;
    } catch (error) {
      this.logger.error('report failed', error instanceof Error ? error : undefined, {
        context: 'Report',
        matchId: prediction.matchId,
      });
      return false;
    }
  }
}
