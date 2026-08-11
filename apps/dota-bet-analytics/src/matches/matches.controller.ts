import { Controller, Get } from '@nestjs/common';

import { LiveMatchesService } from './live-matches.service.js';

/** Read-only view of the match registry. */
@Controller('matches')
export class MatchesController {
  constructor(private readonly liveMatches: LiveMatchesService) {}

  @Get('live')
  async live() {
    const matches = await this.liveMatches.findLiveWithProgress();
    return { count: matches.length, matches };
  }

  @Get('recent')
  async recent() {
    const matches = await this.liveMatches.findRecent();
    return { count: matches.length, matches };
  }
}
