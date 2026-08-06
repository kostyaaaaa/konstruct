import { Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';

import { isWorkerName } from './worker-state.schema.js';
import { WorkerStateService } from './worker-state.service.js';

/**
 * The console's control screen.
 *
 * Pausing stops the work, not the process — the API keeps serving, and the
 * state survives a restart because it lives in the database. There is
 * deliberately no endpoint that stops the process: nothing would be left
 * running to start it again.
 */
@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkerStateService) {}

  @Get()
  async list() {
    const workers = await this.workers.list();
    return { workers };
  }

  @Post(':name/pause')
  async pause(@Param('name') name: string) {
    return this.workers.setStatus(this.assertKnown(name), 'paused');
  }

  @Post(':name/resume')
  async resume(@Param('name') name: string) {
    return this.workers.setStatus(this.assertKnown(name), 'running');
  }

  /** Unknown names are a 404, not a silently created row. */
  private assertKnown(name: string) {
    if (!isWorkerName(name)) {
      throw new NotFoundException(`Unknown worker: ${name}`);
    }
    return name;
  }
}
