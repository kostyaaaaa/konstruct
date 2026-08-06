import { dashboardUrl } from '@/lib/links';

import type { BackToKonstructProps } from './types';

/**
 * The Konstruct mark, linking back to the dashboard.
 *
 * The same 2x2 grid the dashboard uses for itself, built from divs so it picks
 * up this app's tokens rather than carrying its own colours. Recognisable as
 * "back to the platform" without needing a label.
 */
export function BackToKonstruct({ href = dashboardUrl() }: BackToKonstructProps) {
  return (
    <a
      href={href}
      title="Back to Konstruct"
      aria-label="Back to Konstruct"
      className="grid size-8 shrink-0 grid-cols-2 grid-rows-2 gap-[2px] rounded-lg bg-konstruct p-1.5 opacity-80 transition-opacity hover:opacity-100"
    >
      <span className="rounded-[1px] bg-konstruct-mark" />
      <span className="rounded-[1px] bg-konstruct-mark-dim" />
      <span className="rounded-[1px] bg-konstruct-mark-dim" />
      <span className="rounded-[1px] bg-konstruct-mark" />
    </a>
  );
}
