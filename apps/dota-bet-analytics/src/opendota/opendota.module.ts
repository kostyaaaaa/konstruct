import { Module } from '@nestjs/common';

import { OpenDotaService } from './opendota.service.js';

@Module({
  providers: [OpenDotaService],
  exports: [OpenDotaService],
})
export class OpenDotaModule {}
