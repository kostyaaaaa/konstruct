import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Axiom } from '@axiomhq/js';

import type { Env } from '../config/env.schema.js';
import { AppLogger } from '../logger/logger.service.js';

export interface LogQuery {
  /** Lowest level to include. */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Restrict to one service, e.g. `api` or `web`. */
  service?: string;
  /** Restrict to one environment, e.g. `prod`. */
  env?: string;
  /** How far back to look, in hours. */
  hours?: number;
  limit?: number;
}

export interface LogRow {
  time: string;
  level: string;
  message: string;
  service?: string;
  env?: string;
  context?: string;
}

const LEVEL_ORDER = ['debug', 'info', 'warn', 'error'] as const;

/**
 * Reads one flattened column.
 *
 * Axiom returns nested objects as dotted column names — the logger's
 * `fields.env` arrives as a key literally called `fields.env`, not as
 * `fields` containing `env`. Empty columns come back as `null`, which is not
 * a value worth showing.
 */
function text(event: Record<string, unknown>, column: string): string | undefined {
  const value = event[column];
  return value === null || value === undefined ? undefined : String(value);
}

@Injectable()
export class LogsService {
  private client: Axiom | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly logger: AppLogger,
  ) {}

  /** Whether a query token is configured. Reading logs needs one. */
  get available(): boolean {
    return Boolean(this.config.get('AXIOM_QUERY_TOKEN', { infer: true }));
  }

  /**
   * Reads recent events back out of Axiom.
   *
   * This uses `AXIOM_QUERY_TOKEN`, which is **not** the ingest token the
   * logger writes with. Ingest tokens cannot read — asking Axiom to query with
   * one returns 403 — and a token that can read a whole organisation must
   * never leave the server, which is why this is an API endpoint rather than
   * something the console calls directly.
   */
  async recent(query: LogQuery = {}): Promise<LogRow[]> {
    const token = this.config.get('AXIOM_QUERY_TOKEN', { infer: true });
    if (!token) {
      return [];
    }

    const dataset = this.config.get('AXIOM_DATASET', { infer: true });
    const edge = this.config.get('AXIOM_EDGE', { infer: true });

    this.client ??= new Axiom({ token, ...(edge ? { edge } : {}) });

    const { level = 'info', service, env, hours = 24, limit = 100 } = query;
    const allowed = LEVEL_ORDER.slice(LEVEL_ORDER.indexOf(level))
      .map((value) => `"${value}"`)
      .join(', ');

    /* Axiom flattens nested objects into dotted column names, so the logger's
       `fields.service` is a column called exactly that — not a `service`
       column, and not a nested object. Dotted names need bracket notation in
       APL. */
    const filters = [`level in (${allowed})`];
    if (service) {
      filters.push(`['fields.service'] == "${service.replace(/"/g, '')}"`);
    }
    /* dev and prod share one dataset, separated only by this field. Without
       the filter the console mixes a developer's laptop with production and
       gives no way to tell them apart. */
    if (env) {
      filters.push(`['fields.env'] == "${env.replace(/"/g, '')}"`);
    }

    const apl = [
      `['${dataset}']`,
      `where ${filters.join(' and ')}`,
      `sort by _time desc`,
      `limit ${Math.min(limit, 500)}`,
    ].join(' | ');

    try {
      const result = await this.client.query(apl, {
        startTime: new Date(Date.now() - hours * 3600_000).toISOString(),
        endTime: new Date().toISOString(),
      });

      /* Axiom returns columns, not rows. `events()` is the SDK's own iterator
         that zips them back into records — safer than indexing columns by
         position, which breaks the moment a field is added. */
      const table = result.tables?.[0];
      if (!table) {
        return [];
      }

      const rows: LogRow[] = [];
      for (const event of table.events()) {
        rows.push({
          time: String(event._time ?? ''),
          level: String(event.level ?? ''),
          message: String(event.message ?? ''),
          service: text(event, 'fields.service'),
          env: text(event, 'fields.env'),
          context: text(event, 'fields.context'),
        });
      }
      return rows;
    } catch (error) {
      this.logger.error('axiom query failed', error instanceof Error ? error : undefined, {
        context: 'Logs',
        apl,
      });
      throw error;
    }
  }
}
