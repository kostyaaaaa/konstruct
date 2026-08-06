import { Global, Module } from '@nestjs/common';

import { AppLogger } from './logger.service.js';

/**
 * Global so any provider can inject `AppLogger` without importing this module.
 * Logging is genuinely cross-cutting; everything else stays explicit.
 */
@Global()
@Module({
  providers: [AppLogger],
  exports: [AppLogger],
})
export class LoggerModule {}
