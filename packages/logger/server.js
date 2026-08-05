import { Axiom } from '@axiomhq/js';
import { AxiomJSTransport, ConsoleTransport, Logger } from '@axiomhq/logging';

/**
 * Logger for anything running on a server: a Node worker, an Express or NestJS
 * app, a Next.js server component or route handler.
 *
 * It holds the Axiom token, so it must never be imported into browser code.
 * Use `@konstruct/logger/client` there.
 *
 *   import { createLogger } from '@konstruct/logger/server'
 *   export const logger = createLogger({ dataset: 'dota-bet-analytics' })
 *
 *   logger.info('match analysed', { matchId })
 *
 * Every event goes to the console and, when a token is configured, to Axiom,
 * carrying an `env` field so one dataset can be filtered per environment.
 * Without a token it degrades to console only, so a machine with no Axiom
 * access still runs.
 *
 * @param {import('./server.d.ts').ServerLoggerOptions} [options]
 * @returns {Logger}
 */
export function createLogger(options = {}) {
  const {
    dataset = process.env.AXIOM_DATASET,
    token = process.env.AXIOM_TOKEN,
    edge = process.env.AXIOM_EDGE,
    env = process.env.ENV ?? 'unknown',
    level = process.env.LOG_LEVEL ?? 'info',
    fields,
    prettyPrint = process.env.NODE_ENV !== 'production',
  } = options;

  const transports = [new ConsoleTransport({ prettyPrint, logLevel: level })];

  if (token && dataset) {
    transports.push(
      new AxiomJSTransport({
        axiom: new Axiom({
          token,
          ...(edge ? { edge } : {}),
          // Without this, a rejected ingest — bad token, missing dataset,
          // network gone — is swallowed and the events vanish with no sign.
          // It goes to the console rather than through this logger, which
          // would try to ship it to the same broken transport.
          onError: (err) =>
            console.error(
              `[@konstruct/logger] ingest to "${dataset}" failed: ${err?.message ?? err}`,
            ),
        }),
        dataset,
        logLevel: level,
      }),
    );
  } else if (process.env.NODE_ENV === 'production') {
    // Losing production logs silently is worse than a noisy start-up.
    console.warn(
      '[@konstruct/logger] AXIOM_DATASET or AXIOM_TOKEN is missing. Logging to the console only.',
    );
  }

  // `env` is attached to every event, so one dataset per app can still be
  // filtered down to a single environment.
  return new Logger({ transports, logLevel: level }).with({ env, ...fields });
}

/**
 * Flush pending events before the process exits.
 *
 * Axiom sends in batches, so a short-lived script — a cron task, a one-off
 * migration — can exit with its last events still in memory. A long-running
 * server should call this on SIGTERM as part of its shutdown.
 *
 * @param {Logger} logger
 * @returns {Promise<void>}
 */
export async function flush(logger) {
  await logger.flush();
}
