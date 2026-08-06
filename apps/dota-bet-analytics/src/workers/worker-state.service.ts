import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppLogger } from '../logger/logger.service.js';
import {
  WORKER_NAMES,
  WorkerState,
  type WorkerName,
  type WorkerStatus,
} from './worker-state.schema.js';

@Injectable()
export class WorkerStateService {
  constructor(
    @InjectModel(WorkerState.name) private readonly model: Model<WorkerState>,
    private readonly logger: AppLogger,
  ) {}

  /**
   * A worker with no row yet is running. Defaulting to running means a new
   * worker starts collecting rather than sitting silently idle — and the
   * snapshot archive cannot be backfilled, so silence is the costly failure.
   */
  async isPaused(name: WorkerName): Promise<boolean> {
    const state = await this.model.findOne({ name }).select('status').lean<{
      status: WorkerStatus;
    }>();
    return state?.status === 'paused';
  }

  async setStatus(name: WorkerName, status: WorkerStatus): Promise<WorkerState> {
    const updated = await this.model
      .findOneAndUpdate(
        { name },
        { $set: { name, status, lastChangedAt: new Date() } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean<WorkerState>()
      .exec();

    this.logger.log('worker state changed', { context: 'Workers', worker: name, status });
    return updated;
  }

  /** Every known worker, including those with no row yet. */
  async list(): Promise<{ name: WorkerName; status: WorkerStatus; lastChangedAt?: Date }[]> {
    const stored = await this.model.find().lean<WorkerState[]>().exec();
    const byName = new Map(stored.map((state) => [state.name, state]));

    return WORKER_NAMES.map((name) => {
      const state = byName.get(name);
      return {
        name,
        status: state?.status ?? 'running',
        ...(state?.lastChangedAt ? { lastChangedAt: state.lastChangedAt } : {}),
      };
    });
  }
}
