'use server';

import { revalidatePath } from 'next/cache';

import { post } from '@/lib/api';
import { flushLogs, logger } from '@/lib/logger';

/**
 * Worker control.
 *
 * Server actions rather than a client-side fetch, so `API_URL` stays on the
 * server and the browser never learns where the API lives.
 *
 * **These are the only things the console logs.** Everything else it does is a
 * read that the API has already recorded from its own side; logging those
 * again would duplicate the same event in two datasets. A write is different:
 * a paused worker looks identical to a broken one, and without a line here
 * there is no record that anybody asked for it.
 */

type WorkerAction = 'pause' | 'resume';

async function controlWorker(formData: FormData, action: WorkerAction): Promise<void> {
  const name = String(formData.get('name') ?? '');

  if (!name) {
    logger.warn('worker control ignored', { context: 'Actions', action, reason: 'no worker name' });
    await flushLogs();
    return;
  }

  const { ok, status } = await post(`/workers/${name}/${action}`);

  if (ok) {
    logger.info('worker control', { context: 'Actions', action, worker: name });
  } else {
    logger.error('worker control failed', { context: 'Actions', action, worker: name, status });
  }

  await flushLogs();
  revalidatePath('/');
}

export async function pauseWorker(formData: FormData): Promise<void> {
  await controlWorker(formData, 'pause');
}

export async function resumeWorker(formData: FormData): Promise<void> {
  await controlWorker(formData, 'resume');
}

export async function runBackfill(): Promise<void> {
  const { ok, status } = await post('/backfill/run');

  if (ok) {
    logger.info('backfill requested', { context: 'Actions' });
  } else {
    logger.error('backfill request failed', { context: 'Actions', status });
  }

  await flushLogs();
  revalidatePath('/');
}
