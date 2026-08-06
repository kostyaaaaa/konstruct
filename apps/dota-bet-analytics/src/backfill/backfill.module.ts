import { Module } from '@nestjs/common';

import { MatchesModule } from '../matches/matches.module.js';
import { OpenDotaModule } from '../opendota/opendota.module.js';
import { PredictionsModule } from '../predictions/predictions.module.js';
import { WorkersModule } from '../workers/workers.module.js';
import { BackfillController } from './backfill.controller.js';
import { BackfillService } from './backfill.service.js';

/** Reads the registry and predictions; nothing depends on it in return. */
@Module({
  imports: [PredictionsModule, MatchesModule, OpenDotaModule, WorkersModule],
  controllers: [BackfillController],
  providers: [BackfillService],
  exports: [BackfillService],
})
export class BackfillModule {}
