import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { HeroesModule } from '../heroes/heroes.module.js';
import { OpenDotaModule } from '../opendota/opendota.module.js';
import { Prediction, PredictionSchema } from './prediction.schema.js';
import { PredictionsController } from './predictions.controller.js';
import { PredictionsService } from './predictions.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Prediction.name, schema: PredictionSchema }]),
    OpenDotaModule,
    HeroesModule,
  ],
  controllers: [PredictionsController],
  providers: [PredictionsService],
  exports: [PredictionsService],
})
export class PredictionsModule {}
