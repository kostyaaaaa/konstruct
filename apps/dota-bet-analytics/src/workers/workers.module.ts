import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkerState, WorkerStateSchema } from './worker-state.schema.js';
import { WorkerStateService } from './worker-state.service.js';
import { WorkersController } from './workers.controller.js';

/**
 * Depends on nothing but its own collection, so any worker can import it
 * without creating a cycle.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: WorkerState.name, schema: WorkerStateSchema }])],
  controllers: [WorkersController],
  providers: [WorkerStateService],
  exports: [WorkerStateService],
})
export class WorkersModule {}
