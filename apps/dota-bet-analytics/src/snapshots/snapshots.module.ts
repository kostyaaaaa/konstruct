import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MatchSnapshot, MatchSnapshotSchema } from './match-snapshot.schema.js';
import { SnapshotsController } from './snapshots.controller.js';
import { SnapshotsService } from './snapshots.service.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: MatchSnapshot.name, schema: MatchSnapshotSchema }])],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
