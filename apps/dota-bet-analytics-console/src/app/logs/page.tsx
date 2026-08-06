import Link from 'next/link';

import { Panel } from '@/components/Panel';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

const LEVEL_CLASS: Record<string, string> = {
  debug: 'text-faint',
  info: 'text-muted',
  warn: 'text-warn',
  error: 'text-bad',
};

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level } = await searchParams;
  const active = LEVELS.includes(level as (typeof LEVELS)[number]) ? level! : 'info';
  const logs = await api.logs(active);

  return (
    <Panel
      title="Logs"
      action={
        <div className="flex gap-1">
          {LEVELS.map((value) => (
            <Link
              key={value}
              href={`/logs?level=${value}`}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                value === active ? 'bg-field text-ink' : 'text-faint hover:bg-surface'
              }`}
            >
              {value}
            </Link>
          ))}
        </div>
      }
    >
      {!logs ? (
        <p className="text-sm text-muted">Could not reach the API.</p>
      ) : !logs.available ? (
        <p className="text-sm text-muted">{logs.reason}</p>
      ) : logs.rows.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing at <code className="font-mono">{active}</code> or above in the last 24 hours.
        </p>
      ) : (
        <ul className="space-y-1 font-mono text-xs">
          {logs.rows.map((row, index) => (
            <li key={`${row.time}-${index}`} className="flex gap-3 border-b border-line/50 py-1.5">
              <span className="shrink-0 text-faint">{new Date(row.time).toLocaleTimeString()}</span>
              <span className={`w-12 shrink-0 ${LEVEL_CLASS[row.level] ?? 'text-muted'}`}>
                {row.level}
              </span>
              <span className="min-w-0 flex-1 break-words text-ink">{row.message}</span>
              {row.context && <span className="shrink-0 text-faint">{row.context}</span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
