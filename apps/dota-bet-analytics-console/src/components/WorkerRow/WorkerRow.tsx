import { pauseWorker, resumeWorker } from '@/app/actions';

import type { WorkerRowProps } from './types';

/**
 * One worker with its switch.
 *
 * A plain form posting to a server action — no client JavaScript, and it still
 * works if the page never hydrates.
 */
export function WorkerRow({ worker }: WorkerRowProps) {
  const running = worker.status === 'running';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 rounded-full ${running ? 'bg-ok' : 'bg-warn'}`}
            aria-hidden
          />
          <span className="font-mono text-sm">{worker.name}</span>
        </div>
        <div className="mt-0.5 pl-4 text-xs text-faint">
          {running ? 'running' : 'paused'}
          {worker.lastChangedAt && ` · changed ${new Date(worker.lastChangedAt).toLocaleString()}`}
        </div>
      </div>

      <form action={running ? pauseWorker : resumeWorker}>
        <input type="hidden" name="name" value={worker.name} />
        <button
          type="submit"
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            running
              ? 'border-warn/40 bg-warn-tint text-warn hover:border-warn/70'
              : 'border-ok/40 bg-ok-tint text-ok hover:border-ok/70'
          }`}
        >
          {running ? 'Pause' : 'Resume'}
        </button>
      </form>
    </div>
  );
}
