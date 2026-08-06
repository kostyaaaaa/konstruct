import { Hint } from '@/components/Hint';

import type { StatGridProps, StatProps } from './types';

const toneClass = {
  neutral: 'text-ink',
  accent: 'text-accent',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  muted: 'text-muted',
} as const;

/**
 * A figure above its label — the number first, because that is what is being
 * looked for.
 */
export function Stat({ label, value, hint, title, tone = 'neutral' }: StatProps) {
  const caption = hint ?? label;

  return (
    <div className="bg-surface p-[18px]">
      <div className={`mono text-[22px] font-semibold ${toneClass[tone]}`}>{value}</div>
      <div className="mt-1 text-xs text-faint">
        {title ? <Hint text={title}>{caption}</Hint> : caption}
      </div>
    </div>
  );
}

/**
 * Four figures across, separated by hairlines.
 *
 * The dividers are a 1px grid gap showing the `line` background through —
 * cheaper than bordering each cell and it never doubles up at the joins.
 */
export function StatGrid({ children }: StatGridProps) {
  return <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">{children}</div>;
}
