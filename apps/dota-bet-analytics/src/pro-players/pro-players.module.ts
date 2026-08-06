import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OpenDotaModule } from '../opendota/opendota.module.js';
import { ProPlayer, ProPlayerSchema } from './pro-player.schema.js';
import { ProPlayersService } from './pro-players.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ProPlayer.name, schema: ProPlayerSchema }]),
    OpenDotaModule,
  ],
  providers: [ProPlayersService],
  exports: [ProPlayersService],
})
export class ProPlayersModule {}
