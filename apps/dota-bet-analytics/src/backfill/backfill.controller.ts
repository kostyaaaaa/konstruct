import { Controller, Get, Post } from '@nestjs/common';

import { BackfillService } from './backfill.service.js';

@Controller('backfill')
export class BackfillController {
  constructor(private readonly backfill: BackfillService) {}

  @Get('status')
  async status() {
    return this.backfill.status();
  }

  /**
   * Runs a batch immediately instead of waiting for the five-minute tick.
   *
   * Useful right after a match ends, and the only way to drive the backfill
   * from the console without shortening the interval for everything.
   */
  @Post('run')
  async runNow() {
    const resolved = await this.backfill.resolveFinished();
    return { resolved };
  }
}
