import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HttpObserver } from '../common/http-observer.js';
import { fetchJson } from '../common/http.js';
import type { Env } from '../config/env.schema.js';
import { AppLogger } from '../logger/logger.service.js';
import type { Prediction } from '../predictions/prediction.schema.js';
import { PredictionsService } from '../predictions/predictions.service.js';
import { buildReport } from './report.builder.js';
import { countBlocks, RICH_MESSAGE_LIMITS } from './rich-message.js';

interface TelegramResponse {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
}

@Injectable()
export class ReportService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly predictions: PredictionsService,
    private readonly http: HttpObserver,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Posts one prediction to the Telegram channel.
   *
   * **Telegram rather than email**, because the app has no domain to send from.
   * Every mail provider requires a verified sending domain, and the deployment
   * lives on `vercel.app` and `railway.app` subdomains whose DNS we do not
   * control. A bot needs no domain, no DNS and no deliverability reputation,
   * and it cannot be filtered into a spam folder.
   *
   * Returns whether it was sent. A failure is logged, never thrown: the
   * prediction is already stored and visible in the console, and losing the
   * archive because Telegram was unreachable would be the worse outcome.
   */
  async send(prediction: Prediction): Promise<boolean> {
    try {
      const blocks = buildReport(prediction, {
        consoleUrl: this.config.get('CONSOLE_URL', { infer: true }),
        calibration: await this.calibrationFor(prediction),
      });

      const used = countBlocks(blocks);
      if (used > RICH_MESSAGE_LIMITS.blocks) {
        /* Telegram rejects the whole message rather than truncating, so an
           over-long report would be silently lost. Ten players is nowhere
           near the limit — reaching it means something built the wrong thing. */
        throw new Error(`Report uses ${used} blocks, over the ${RICH_MESSAGE_LIMITS.blocks} limit`);
      }

      const token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
      const response = await fetchJson<TelegramResponse>(
        `https://api.telegram.org/bot${token}/sendRichMessage`,
        {
          method: 'POST',
          body: {
            chat_id: this.config.get('TELEGRAM_CHAT_ID', { infer: true }),
            rich_message: { blocks },
          },
          observer: this.http.for('telegram'),
        },
      );

      /* Telegram answers 200 with `ok: false` for an application-level
         refusal — a bot removed from the channel, a malformed block. Without
         this check that reads as success. */
      if (response.ok === false) {
        throw new Error(`Telegram refused the message: ${response.description ?? 'no reason'}`);
      }

      this.logger.log('report sent', {
        context: 'Report',
        matchId: prediction.matchId,
        messageId: response.result?.message_id,
        blocks: used,
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

  /**
   * How past predictions at this confidence or better actually turned out.
   *
   * A margin on its own says how far apart the two scores were; it says
   * nothing about whether that gap has ever meant anything. This is the part
   * that makes the number worth acting on.
   *
   * Never fails the report: an unavailable figure is dropped, because the
   * prediction itself is still worth sending.
   */
  private async calibrationFor(prediction: Prediction) {
    try {
      const accuracy = await this.predictions.accuracy(prediction.marginPercent);
      return { accuracyPercent: accuracy.accuracyPercent, settled: accuracy.settled };
    } catch (error) {
      this.logger.warn('calibration unavailable, sending report without it', {
        context: 'Report',
        matchId: prediction.matchId,
        reason: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }
}
