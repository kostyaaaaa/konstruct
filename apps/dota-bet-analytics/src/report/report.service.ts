import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import { createTransport, type Transporter } from 'nodemailer';

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

@Injectable()
export class ReportService implements OnModuleInit {
  private transporter: Transporter | null = null;
  private template: HandlebarsTemplateDelegate<TemplateModel> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit() {
    registerReportHelpers();

    this.transporter = createTransport({
      service: 'Gmail',
      auth: {
        user: this.config.get('SMTP_EMAIL', { infer: true }),
        pass: this.config.get('SMTP_PASSWORD', { infer: true }),
      },
    });

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
   * Emails one prediction.
   *
   * Returns whether it was sent. A failure is logged and reported, never
   * thrown: the prediction is already stored and visible in the console, and
   * losing the archive because a mail server was down would be the worse
   * outcome.
   */
  async send(prediction: Prediction): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      const html = this.render(prediction);
      const from = this.config.get('SMTP_EMAIL', { infer: true });

      const message = await this.transporter.sendMail({
        from: `dota-bet-analytics <${from}>`,
        to: this.config.get('EMAIL', { infer: true }),
        subject: `${prediction.radiantTeamName ?? 'Radiant'} vs ${prediction.direTeamName ?? 'Dire'}`,
        html,
      });

      this.logger.log('report sent', {
        context: 'Report',
        matchId: prediction.matchId,
        messageId: message.messageId,
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
