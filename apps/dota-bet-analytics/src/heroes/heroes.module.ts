import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Hero, HeroSchema } from './hero.schema.js';
import { HeroesService } from './heroes.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Hero.name, schema: HeroSchema }])],
  providers: [HeroesService],
  exports: [HeroesService],
})
export class HeroesModule {}
