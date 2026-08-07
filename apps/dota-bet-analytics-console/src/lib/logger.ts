import 'server-only';

import { createLogger, flush } from '@konstruct/logger/server';

/**
 * One logger for the whole app, writing to the `dota-bet-analytics-console`
 * dataset.
 *
 * `server-only` for the same reason as `api.ts`: this holds the Axiom ingest
 * token, and a token in the browser lets anyone write into the dataset. If it
 * is ever imported from a client component the build fails rather than
 * shipping it.
 */
export const logger = createLogger();

/**
 * Sends anything still buffered, and must be awaited before a server action
 * returns.
 *
 * Axiom ships in batches, and this app runs as serverless functions that are
 * frozen the instant they respond. Without this the batch is still in memory
 * when the function stops, and the event is simply lost — the failure mode is
 * silence, not an error.
 */
export async function flushLogs(): Promise<void> {
  await flush(logger);
}
