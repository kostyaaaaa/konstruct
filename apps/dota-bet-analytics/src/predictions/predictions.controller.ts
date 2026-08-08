import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';

import { PredictionsService } from './predictions.service.js';

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Get()
  async recent() {
    const predictions = await this.predictions.findRecent();
    return { count: predictions.length, predictions };
  }

  /**
   * `minMarginPercent` is the confidence threshold, and it is a query
   * parameter on purpose. The old app hardcoded one and quietly dropped every
   * closer match from the total, so its accuracy number described only
   * confident calls without saying so.
   */
  @Get('accuracy')
  async accuracy(
    @Query('minMarginPercent', new DefaultValuePipe(0), ParseIntPipe) minMarginPercent: number,
  ) {
    return this.predictions.accuracy(minMarginPercent);
  }

  @Get(':matchId')
  async byMatch(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.predictions.findByMatchId(matchId);
  }
}
