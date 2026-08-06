import type { PanelProps } from './types';

export function Panel({ title, action, children }: PanelProps) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
