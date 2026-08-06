import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { BackfillModule } from './backfill/backfill.module.js';
import { CommonModule } from './common/common.module.js';
import { validateEnv } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { HealthModule } from './health/health.module.js';
import { HeroesModule } from './heroes/heroes.module.js';
import { LeaguesModule } from './leagues/leagues.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { LogsModule } from './logs/logs.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { PredictionsModule } from './predictions/predictions.module.js';
import { ReportModule } from './report/report.module.js';
import { SnapshotsModule } from './snapshots/snapshots.module.js';
import { WorkersModule } from './workers/workers.module.js';

/**
 * Wires the feature modules together and owns nothing itself.
 *
 * `ScheduleModule` is here because the discovery and snapshot workers will
 * need its `SchedulerRegistry` — that registry is what lets a worker be paused
 * and resumed at runtime instead of only at startup.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      /* Infisical injects the real values; nothing is read from a file. */
      ignoreEnvFile: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    LoggerModule,
    CommonModule,
    DatabaseModule,
    HealthModule,
    HeroesModule,
    LeaguesModule,
    LogsModule,
    MatchesModule,
    SnapshotsModule,
    PredictionsModule,
    ReportModule,
    WorkersModule,
    BackfillModule,
    DiscoveryModule,
  ],
})
export class AppModule {}
