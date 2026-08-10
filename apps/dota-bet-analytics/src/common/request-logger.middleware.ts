import { Injectable, type NestMiddleware } from '@nestjs/common';

import { AppLogger } from '../logger/logger.service.js';

/**
 * The four things this middleware touches, declared rather than imported.
 *
 * `@types/express` would work, but it is a dependency to keep current for a
 * handler that reads two fields and subscribes to one event. Naming them here
 * also documents exactly how much of the request this is allowed to see.
 */
interface LoggableRequest {
  method: string;
  /**
   * The path as the client sent it, query string included.
   *
   * **Not `path`, and not `url`.** Express rewrites `url` — and therefore
   * `path` — to the remainder relative to the mount point as it routes, so a
   * middleware applied with `forRoutes('*')` reads `/` for every request.
   * `originalUrl` is the one field routing never touches.
   */
  originalUrl: string;
}

interface LoggableResponse {
  statusCode: number;
  once(event: 'finish', listener: () => void): unknown;
}

/**
 * One line per HTTP request, once the response has been sent.
 *
 * **Added because "was the API responding?" had no answer.** The app logged
 * nothing about requests, so a wedged HTTP server and a healthy idle one
 * produced identical silence, and the only evidence either way had to be
 * reconstructed from database side effects.
 *
 * It logs on `finish`, not on arrival, so the status and the duration are
 * real. A request that never completes therefore never logs — which is itself
 * the signal, read against the discovery heartbeat.
 *
 * `/health` goes to `debug` rather than `info`. Railway probes it constantly
 * and at `info` it would bury every other line; at `debug` it is dropped in
 * production but available by raising `LOG_LEVEL` when a probe is the
 * question.
 *
 * Nothing from the query string or the body is recorded. Neither is needed to
 * answer whether the API was up, and both are places a secret can hide.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(request: LoggableRequest, response: LoggableResponse, next: () => void): void {
    const startedAt = process.hrtime.bigint();
    /* The query string is dropped rather than logged: it is where an API key
       would sit, and the path alone answers whether a route was reached. */
    const path = request.originalUrl.split('?')[0] ?? '/';
    const method = request.method;

    response.once('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
      const fields = {
        context: 'Http',
        method,
        path,
        status: response.statusCode,
        durationMs,
      };

      if (path === '/health') {
        this.logger.debug('request', fields);
        return;
      }

      /* A 5xx is ours and needs looking at; a 4xx is the caller's problem but
         still worth seeing when a console screen goes blank. */
      if (response.statusCode >= 500) {
        this.logger.error('request failed', undefined, fields);
      } else if (response.statusCode >= 400) {
        this.logger.warn('request rejected', fields);
      } else {
        this.logger.log('request', fields);
      }
    });

    next();
  }
}
