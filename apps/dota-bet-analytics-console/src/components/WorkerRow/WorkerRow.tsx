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
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-3 last:border-0">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block size-1.5 rounded-full ${running ? 'bg-ok' : 'bg-warn'}`}
            aria-hidden
          />
          <span className="mono text-[13px]">{worker.name}</span>
          <span className={`text-xs ${running ? 'text-ok' : 'text-warn'}`}>
            {running ? 'running' : 'paused'}
          </span>
        </div>
        {worker.lastChangedAt && (
          <div className="mt-0.5 pl-4 text-xs text-faint">
            changed {new Date(worker.lastChangedAt).toLocaleString()}
          </div>
        )}
      </div>

      <form action={running ? pauseWorker : resumeWorker}>
        <input type="hidden" name="name" value={worker.name} />
        <button
          type="submit"
          className={`rounded-md border px-3 py-1 text-xs transition-colors ${
            running
              ? 'border-line text-muted hover:border-warn/60 hover:text-warn'
              : 'border-ok/40 text-ok hover:border-ok'
          }`}
        >
          {running ? 'Pause' : 'Resume'}
        </button>
      </form>
    </div>
  );
}
