import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

import { PredictionsService } from './predictions.service.js';

/**
 * `league` is a league id, and it is optional everywhere it appears. Nest's
 * `ParseIntPipe` still rejects a non-numeric one with a 400 rather than
 * silently ignoring it, so a typo in a link fails loudly.
 */
const optionalLeague = new ParseIntPipe({ optional: true });

/**
 * Margins are decimals — a prediction sits at 2.95% or 9.8% — so the threshold
 * has to be one too. Parsed as a float, not an int, or a search for 4.5 is a
 * 400 rather than an answer.
 */
const marginPipes = [new DefaultValuePipe(0), ParseFloatPipe] as const;

/**
 * `includeSuspicious` defaults to **true** here, and the console asks for
 * `false`.
 *
 * The endpoint's job is to describe everything stored; hiding rows by default
 * would make the API disagree with the database for anyone who called it
 * plainly. Which matches are worth looking at is the reader's decision, and
 * the console makes it — its checkbox starts on.
 */
function parseIncludeSuspicious(raw?: string): boolean {
  return raw === undefined ? true : raw !== 'false' && raw !== '0';
}

@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Get()
  async recent(
    @Query('minMarginPercent', ...marginPipes) minMarginPercent: number,
    @Query('league', optionalLeague) league?: number,
    @Query('includeSuspicious') includeSuspicious?: string,
  ) {
    const predictions = await this.predictions.findRecent(
      50,
      league,
      parseIncludeSuspicious(includeSuspicious),
      minMarginPercent,
    );
    return { count: predictions.length, predictions };
  }

  /**
   * Declared before `:matchId`, and it has to be. Nest matches routes in
   * declaration order, so a `:matchId` above this would swallow `/leagues` and
   * fail trying to parse it as a number.
   */
  @Get('leagues')
  async leagues(@Query('includeSuspicious') includeSuspicious?: string) {
    const leagues = await this.predictions.leagues(parseIncludeSuspicious(includeSuspicious));
    return { count: leagues.length, leagues };
  }

  /**
   * `minMarginPercent` is the confidence threshold, and it is a query
   * parameter on purpose. The old app hardcoded one and quietly dropped every
   * closer match from the total, so its accuracy number described only
   * confident calls without saying so.
   *
   * `league` narrows the same figure to one tournament. Pooled accuracy hides
   * the difference between an event the model reads well and one it does not,
   * and those are not the same bet.
   */
  @Get('accuracy')
  async accuracy(
    @Query('minMarginPercent', ...marginPipes) minMarginPercent: number,
    @Query('league', optionalLeague) league?: number,
    @Query('includeSuspicious') includeSuspicious?: string,
  ) {
    return this.predictions.accuracy(
      minMarginPercent,
      league,
      parseIncludeSuspicious(includeSuspicious),
    );
  }

  @Get(':matchId')
  async byMatch(@Param('matchId', ParseIntPipe) matchId: number) {
    return this.predictions.findByMatchId(matchId);
  }
}
