import { Module } from '@nestjs/common';

import { LeaguesModule } from '../leagues/leagues.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { PredictionsModule } from '../predictions/predictions.module.js';
import { ReportModule } from '../report/report.module.js';
import { SnapshotsModule } from '../snapshots/snapshots.module.js';
import { WorkersModule } from '../workers/workers.module.js';
import { DiscoveryController } from './discovery.controller.js';
import { DiscoveryService } from './discovery.service.js';

/** Dependencies point one way: discovery -> registry, archive, state. */
@Module({
  imports: [
    LeaguesModule,
    MatchesModule,
    SnapshotsModule,
    PredictionsModule,
    ReportModule,
    WorkersModule,
  ],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
