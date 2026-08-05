import type { Logger, LogLevel } from '@axiomhq/logging';

export interface ServerLoggerOptions {
  /** Axiom dataset to write to. Defaults to `AXIOM_DATASET`. */
  dataset?: string;
  /** Axiom ingest token. Defaults to `AXIOM_TOKEN`. */
  token?: string;
  /** Regional ingest endpoint, e.g. `eu-central-1.aws.edge.axiom.co`. Defaults to `AXIOM_EDGE`. */
  edge?: string;
  /** Environment attached to every event as `env`. Defaults to `ENV`, then `'unknown'`. */
  env?: string;
  /** Lowest level that is sent. Defaults to `LOG_LEVEL`, then `info`. */
  level?: LogLevel;
  /** Fields attached to every event from this logger. */
  fields?: Record<string, unknown>;
  /** Human-readable console output. Defaults to on outside production. */
  prettyPrint?: boolean;
}

export declare function createLogger(options?: ServerLoggerOptions): Logger;

export declare function flush(logger: Logger): Promise<void>;
