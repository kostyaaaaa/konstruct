import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

import { SnapshotsService } from './snapshots.service.js';

@Controller('snapshots')
export class SnapshotsController {
  constructor(private readonly snapshots: SnapshotsService) {}

  /** Trimmed series for the match-detail graph. */
  @Get(':matchId/series')
  async series(@Param('matchId', ParseIntPipe) matchId: number) {
    const points = await this.snapshots.findSeries(matchId);
    return { matchId, count: points.length, points };
  }

  /** Full snapshots, raw payload included. */
  @Get(':matchId')
  async forMatch(@Param('matchId', ParseIntPipe) matchId: number) {
    const snapshots = await this.snapshots.findForMatch(matchId);
    return { matchId, count: snapshots.length, snapshots };
  }
}
