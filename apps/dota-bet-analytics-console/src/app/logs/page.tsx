import Link from 'next/link';

import { Panel } from '@/components/Panel';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * No `debug` tab, deliberately.
 *
 * The filter is cumulative — a level shows itself and everything above it — so
 * `debug` could only ever differ from `info` by including debug lines. The
 * backend leaves `LOG_LEVEL` at `info`, so it emits none: seven days of the
 * dataset held 1,720 info, 39 warn, 16 error and zero debug. The tab showed
 * the info tab's output under a different name.
 *
 * The API still serves `level=debug`, so raising `LOG_LEVEL` on a machine that
 * wants the per-poll detail loses nothing but this shortcut.
 */
const LEVELS = ['info', 'warn', 'error'] as const;
const ENVS = ['all', 'dev', 'prod'] as const;

const LEVEL_CLASS: Record<string, string> = {
  info: 'text-muted',
  warn: 'text-warn',
  error: 'text-bad',
};

/**
 * Date and time, not time alone.
 *
 * Everything here is within the last 24 hours, which spans two calendar days —
 * without the date, yesterday evening and this morning look equally recent and
 * the ordering reads as jumbled.
 */
function stamp(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  return {
    day: today ? 'today' : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
    time: date.toLocaleTimeString(),
  };
}

function tab(active: boolean) {
  return `rounded-md px-2.5 py-1 text-xs transition-colors ${
    active ? 'bg-field text-ink' : 'text-faint hover:bg-surface hover:text-muted'
  }`;
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; env?: string }>;
}) {
  const params = await searchParams;
  const level = LEVELS.includes(params.level as (typeof LEVELS)[number]) ? params.level! : 'info';

  /**
   * Defaults to the environment this console is running in.
   *
   * Both environments write to one Axiom dataset, so `all` mixes a developer's
   * laptop with production. Landing on your own environment means the first
   * thing you see is relevant; `all` is still one click away when you want to
   * compare.
   */
  const defaultEnv = ENVS.includes(process.env.ENV as (typeof ENVS)[number])
    ? process.env.ENV!
    : 'all';
  const env = ENVS.includes(params.env as (typeof ENVS)[number]) ? params.env! : defaultEnv;

  const logs = await api.logs(level, env === 'all' ? undefined : env);
  const href = (next: { level?: string; env?: string }) =>
    `/logs?level=${next.level ?? level}&env=${next.env ?? env}`;

  return (
    <Panel
      title="Logs"
      action={
        <div className="flex flex-wrap items-center gap-3 max-sm:gap-2">
          <div className="flex gap-1">
            {ENVS.map((value) => (
              <Link key={value} href={href({ env: value })} className={tab(value === env)}>
                {value}
              </Link>
            ))}
          </div>
          <span className="text-line-strong">|</span>
          <div className="flex gap-1">
            {LEVELS.map((value) => (
              <Link key={value} href={href({ level: value })} className={tab(value === level)}>
                {value}
              </Link>
            ))}
          </div>
        </div>
      }
    >
      {!logs ? (
        <p className="text-sm text-muted">Could not reach the API.</p>
      ) : !logs.available ? (
        <p className="text-sm text-muted">{logs.reason}</p>
      ) : logs.rows.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing at <code className="mono">{level}</code> or above
          {env !== 'all' && (
            <>
              {' '}
              from <code className="mono">{env}</code>
            </>
          )}{' '}
          in the last 24 hours.
        </p>
      ) : (
        <ul className="space-y-1 mono text-xs">
          {logs.rows.map((row, index) => {
            const when = stamp(row.time);
            return (
              <li
                key={`${row.time}-${index}`}
                className="flex flex-wrap gap-3 border-b border-line/40 py-1.5 max-sm:gap-x-2 max-sm:gap-y-1"
              >
                <span className="w-12 shrink-0 text-faint">{when.day}</span>
                <span className="shrink-0 text-faint">{when.time}</span>
                <span
                  className={`w-10 shrink-0 ${row.env === 'prod' ? 'text-ok' : 'text-faint'}`}
                  title={`environment: ${row.env ?? 'unknown'}`}
                >
                  {row.env ?? '?'}
                </span>
                <span className={`w-12 shrink-0 ${LEVEL_CLASS[row.level] ?? 'text-muted'}`}>
                  {row.level}
                </span>
                <span className="min-w-0 flex-1 wrap-break-word text-ink max-sm:order-5 max-sm:basis-full">
                  {row.message}
                </span>
                {row.context && (
                  <span className="shrink-0 text-faint max-sm:order-6 max-sm:basis-full max-sm:text-[11px]">
                    {row.context}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
