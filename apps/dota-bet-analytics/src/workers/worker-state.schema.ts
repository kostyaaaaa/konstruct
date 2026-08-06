import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** Every worker that can be paused. Adding one here makes it controllable. */
export const WORKER_NAMES = ['discovery', 'backfill'] as const;
export type WorkerName = (typeof WORKER_NAMES)[number];

export const WORKER_STATUSES = ['running', 'paused'] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export function isWorkerName(value: string): value is WorkerName {
  return (WORKER_NAMES as readonly string[]).includes(value);
}

/**
 * Whether a worker should be doing its work.
 *
 * Kept in the database rather than in memory on purpose. The process always
 * runs — pausing stops the *work*, not the process — so the state has to
 * outlive a restart. If it were in memory, a deploy would silently resume a
 * worker somebody had deliberately stopped.
 */
@Schema({ collection: 'worker_state', timestamps: true })
export class WorkerState {
  @Prop({ required: true, unique: true, index: true })
  name!: string;

  @Prop({ required: true, enum: WORKER_STATUSES, default: 'running' })
  status!: WorkerStatus;

  @Prop()
  lastChangedAt?: Date;
}

export type WorkerStateDocument = HydratedDocument<WorkerState>;
export const WorkerStateSchema = SchemaFactory.createForClass(WorkerState);
