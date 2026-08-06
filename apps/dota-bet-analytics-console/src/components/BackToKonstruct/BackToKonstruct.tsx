import { dashboardUrl } from '@/lib/links';

import type { BackToKonstructProps } from './types';

/**
 * The Konstruct mark and wordmark, linking back to the dashboard.
 *
 * Smaller and quieter than the console's own mark beside it: this is the way
 * out, not the identity of the page you are on.
 */
export function BackToKonstruct({ href = dashboardUrl() }: BackToKonstructProps) {
  return (
    <a
      href={href}
      title="Back to Konstruct"
      className="flex items-center gap-2 text-[12.5px] text-dim no-underline transition-colors hover:text-ink"
    >
      <span className="grid size-4 grid-cols-2 grid-rows-2 gap-[1.5px] rounded-[3px] bg-konstruct p-[2.5px]">
        <span className="rounded-[1px] bg-konstruct-mark" />
        <span className="rounded-[1px] bg-konstruct-mark-dim" />
        <span className="rounded-[1px] bg-konstruct-mark-dim" />
        <span className="rounded-[1px] bg-konstruct-mark" />
      </span>
      <span className="max-sm:hidden">Konstruct</span>
    </a>
  );
}
