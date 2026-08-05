import { ConsoleTransport, Logger, ProxyTransport } from '@axiomhq/logging';

/**
 * Logger for code that runs in the browser.
 *
 * It takes **no token**. An Axiom ingest token shipped to the browser is a
 * public token — anyone can read it and write into the dataset. Instead the
 * events are posted to a route in your own app, which holds the token and
 * forwards them. That route is the `url` below.
 *
 *   'use client'
 *   import { createClientLogger } from '@konstruct/logger/client'
 *   const logger = createClientLogger()
 *
 *   logger.error('search failed', { query })
 *
 * @param {import('./client.d.ts').ClientLoggerOptions} [options]
 * @returns {Logger}
 */
export function createClientLogger(options = {}) {
  const {
    url = '/api/logs',
    level = 'info',
    autoFlush = true,
    // The browser cannot read ENV — only variables the bundler inlined. Next.js
    // inlines those prefixed with NEXT_PUBLIC_, so the environment has to be
    // published under that name to reach client code.
    env = process.env.NEXT_PUBLIC_ENV ?? 'unknown',
    fields,
  } = options;

  return new Logger({
    transports: [
      new ConsoleTransport({ prettyPrint: true, logLevel: level }),
      new ProxyTransport({ url, autoFlush, logLevel: level }),
    ],
    logLevel: level,
  }).with({ env, source: 'browser', ...fields });
}
