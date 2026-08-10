import { Injectable } from '@nestjs/common';

import { AppLogger } from '../logger/logger.service.js';
import { redactUrl, type FetchObserver } from './http.js';

/**
 * Turns `fetchJson` retries into log lines.
 *
 * One shared observer rather than each caller inventing its own, so every
 * outbound request reports failures the same way and a rate-limit problem is
 * one Axiom query away regardless of which API caused it.
 */
@Injectable()
export class HttpObserver {
  constructor(private readonly logger: AppLogger) {}

  /** Scoped to the API being called, so `api` is a filterable field. */
  for(api: string): FetchObserver {
    return {
      onRetry: ({ url, attempt, reason, waitMs }) => {
        this.logger.warn('external request retrying', {
          context: 'Http',
          api,
          url: redactUrl(url),
          attempt,
          waitMs,
          reason,
        });
      },
      onGiveUp: ({ url, attempts, reason }) => {
        this.logger.error('external request failed', undefined, {
          context: 'Http',
          api,
          url: redactUrl(url),
          attempts,
          reason,
        });
      },
    };
  }
}
