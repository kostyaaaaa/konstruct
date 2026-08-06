'use server';

import { revalidatePath } from 'next/cache';

import { post } from '@/lib/api';

/**
 * Worker control.
 *
 * Server actions rather than a client-side fetch, so `API_URL` stays on the
 * server and the browser never learns where the API lives.
 */

export async function pauseWorker(formData: FormData) {
  const name = String(formData.get('name') ?? '');
  if (name) await post(`/workers/${name}/pause`);
  revalidatePath('/');
}

export async function resumeWorker(formData: FormData) {
  const name = String(formData.get('name') ?? '');
  if (name) await post(`/workers/${name}/resume`);
  revalidatePath('/');
}

export async function runBackfill() {
  await post('/backfill/run');
  revalidatePath('/');
}
