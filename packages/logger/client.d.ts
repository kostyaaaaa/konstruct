import type { Logger, LogLevel } from '@axiomhq/logging';

export interface ClientLoggerOptions {
  /** Route in your own app that forwards events to Axiom. Defaults to `/api/logs`. */
  url?: string;
  /** Lowest level that is sent. Defaults to `info`. */
  level?: LogLevel;
  /** Send batches automatically, or every `durationMs`. Defaults to `true`. */
  autoFlush?: boolean | { durationMs: number };
  /** Environment attached to every event as `env`. Defaults to `NEXT_PUBLIC_ENV`, then `'unknown'`. */
  env?: string;
  /** Fields attached to every event from this logger. */
  fields?: Record<string, unknown>;
}

export declare function createClientLogger(options?: ClientLoggerOptions): Logger;
