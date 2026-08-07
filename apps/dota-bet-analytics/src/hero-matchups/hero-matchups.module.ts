import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OpenDotaModule } from '../opendota/opendota.module.js';
import { HeroMatchup, HeroMatchupSchema } from './hero-matchup.schema.js';
import { HeroMatchupsService } from './hero-matchups.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HeroMatchup.name, schema: HeroMatchupSchema }]),
    OpenDotaModule,
  ],
  providers: [HeroMatchupsService],
  exports: [HeroMatchupsService],
})
export class HeroMatchupsModule {}
