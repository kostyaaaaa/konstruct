import { Icon } from '@/components/Icon';

import type { AppCardProps } from './types';

export function AppCard({ app }: AppCardProps) {
  return (
    <a
      href={app.href}
      className="flex flex-col gap-3.5 rounded-xl border border-line bg-card p-6 text-ink no-underline transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-line-strong hover:text-ink hover:shadow-[0_4px_14px_oklch(0%_0_0_/_0.05)]"
    >
      <div className="flex size-11 items-center justify-center rounded-[10px] bg-brand-tint">
        <Icon name={app.icon} size={22} className="text-brand-ink" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-base font-semibold text-ink">{app.name}</div>
        <div className="text-[13.5px] leading-[1.5] text-muted">{app.description}</div>
      </div>
    </a>
  );
}
