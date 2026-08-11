import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PredictionsModule } from '../predictions/predictions.module.js';
import { LiveMatch, LiveMatchSchema } from './live-match.schema.js';
import { LiveMatchesService } from './live-matches.service.js';
import { MatchesController } from './matches.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LiveMatch.name, schema: LiveMatchSchema }]),
    PredictionsModule,
  ],
  controllers: [MatchesController],
  providers: [LiveMatchesService],
  exports: [LiveMatchesService],
})
export class MatchesModule {}
