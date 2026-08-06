import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';

import { LogsService, type LogQuery } from './logs.service.js';

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  async recent(
    @Query('level') level?: LogQuery['level'],
    @Query('service') service?: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours = 24,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ) {
    if (!this.logs.available) {
      return {
        available: false,
        reason:
          'AXIOM_QUERY_TOKEN is not set. Reading logs needs a query token, not the ingest one.',
        rows: [],
      };
    }

    const rows = await this.logs.recent({ level, service, hours, limit });
    return { available: true, count: rows.length, rows };
  }
}
