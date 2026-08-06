import type { StatProps } from './types';

const toneClass = {
  neutral: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
} as const;

export function Stat({ label, value, hint, tone = 'neutral' }: StatProps) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  );
}
