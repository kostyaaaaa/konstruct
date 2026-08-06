import type { PanelProps } from './types';

/**
 * The only container in the app.
 *
 * `flush` drops the body padding, for a panel whose content brings its own —
 * a stat grid or a full-width list.
 */
export function Panel({ title, action, flush = false, children }: PanelProps) {
  return (
    <section className="rounded-[10px] border border-line bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-line px-[18px] py-3.5">
        <h2 className="text-[13px] font-semibold tracking-[0.02em] text-muted uppercase">
          {title}
        </h2>
        {action}
      </header>
      <div className={flush ? '' : 'px-[18px] py-4'}>{children}</div>
    </section>
  );
}
