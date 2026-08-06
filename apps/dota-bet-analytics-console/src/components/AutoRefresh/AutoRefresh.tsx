'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { AutoRefreshProps } from './types';

/**
 * Re-fetches the current page on a timer.
 *
 * Every screen here reports something that is true right now — a worker's
 * state, a live match, the last poll. Left alone, all of it silently goes
 * stale and reads as fact, which is worse than showing nothing.
 *
 * `router.refresh()` re-runs the server components and swaps in the new
 * output. It is not a page load: scroll position, focus and any open state
 * survive it, which a `<meta http-equiv="refresh">` would not.
 *
 * **This is the app's only always-on client component.** The rule the console
 * follows is that no figure needs hydration to be readable — not that no
 * JavaScript may exist. Refreshing cannot be done on the server, because the
 * server is not there between requests.
 */
export function AutoRefresh({ intervalMs = 10_000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      /* A background tab has nobody reading it. Polling it anyway spends the
         API's rate limit on output no one sees, and a console left open
         overnight would do it 8,000 times. */
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    };

    const timer = setInterval(tick, intervalMs);

    // Catch up immediately when the tab comes back, rather than showing stale
    // numbers until the next tick.
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [router, intervalMs]);

  return null;
}
