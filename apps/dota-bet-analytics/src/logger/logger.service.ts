import { Injectable, type LoggerService } from '@nestjs/common';

import { createLogger } from '@konstruct/logger/server';

/**
 * Extra data on a log line.
 *
 * A bare string is the Nest convention and means the context — Nest's own
 * calls look like `log(message, 'NestApplication')`. Application code passes
 * an object instead, so the values land in Axiom as **fields** that can be
 * filtered and grouped:
 *
 *   logger.log('match analysed', { context: 'Discovery', matchId })
 *
 * Without this, everything interesting would be glued into the message string
 * and only findable with a substring search.
 */
export type LogDetails = string | Record<string, unknown>;

function toFields(details?: LogDetails): Record<string, unknown> {
  if (!details) return {};
  return typeof details === 'string' ? { context: details } : details;
}

/**
 * Bridges Nest's own logging onto `@konstruct/logger`, so framework messages
 * and application messages land in the same Axiom dataset with the same
 * fields. Without this, Nest writes its startup and error output straight to
 * the console and none of it is searchable.
 *
 * Registered in `main.ts` with `app.useLogger()`.
 */
@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger = createLogger({ fields: { service: 'api' } });

  log(message: unknown, details?: LogDetails) {
    this.logger.info(String(message), toFields(details));
  }

  /**
   * Nest calls this with a stack string; application code usually has the
   * `Error` itself, and often extra context. All three are accepted —
   * widening the parameters keeps this compatible with Nest's `LoggerService`
   * while letting callers keep the stack and attach fields.
   */
  error(message: unknown, cause?: string | Error, details?: LogDetails) {
    const causeFields =
      cause instanceof Error
        ? { error: cause.message, stack: cause.stack, name: cause.name }
        : cause
          ? { stack: cause }
          : {};

    this.logger.error(String(message), { ...causeFields, ...toFields(details) });
  }

  warn(message: unknown, details?: LogDetails) {
    this.logger.warn(String(message), toFields(details));
  }

  debug(message: unknown, details?: LogDetails) {
    this.logger.debug(String(message), toFields(details));
  }

  verbose(message: unknown, details?: LogDetails) {
    this.logger.debug(String(message), toFields(details));
  }

  /** Flush pending events. Called on shutdown so the last logs are not lost. */
  async flush() {
    await this.logger.flush();
  }
}
