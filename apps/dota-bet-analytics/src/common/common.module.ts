import { Global, Module } from '@nestjs/common';

import { HttpObserver } from './http-observer.js';
import { RequestLoggerMiddleware } from './request-logger.middleware.js';

/**
 * Global because every service that calls an external API needs the observer,
 * and threading it through each feature module would add an import to all of
 * them for one shared concern.
 */
@Global()
@Module({
  providers: [HttpObserver, RequestLoggerMiddleware],
  exports: [HttpObserver],
})
export class CommonModule {}
