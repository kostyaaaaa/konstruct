import { Icon } from '@/components/Icon';

import type { AppCardProps } from './types';

const CARD_CLASS =
  'flex flex-col gap-3.5 rounded-xl border border-line bg-card p-6 text-ink no-underline';

const LINK_CLASS =
  'transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-line-strong hover:text-ink hover:shadow-[0_4px_14px_oklch(0%_0_0_/_0.05)]';

export function AppCard({ app, href }: AppCardProps) {
  const body = (
    <>
      <div className="flex size-11 items-center justify-center rounded-[10px] bg-brand-tint">
        <Icon name={app.icon} size={22} className="text-brand-ink" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-base font-semibold text-ink">{app.name}</div>
        <div className="text-[13.5px] leading-[1.5] text-muted">{app.description}</div>
        {!href && <div className="text-[12px] text-muted/70">Not deployed yet</div>}
      </div>
    </>
  );

  /* An app with no URL in this environment is still listed, but is not a link
     — better than a card that looks clickable and goes nowhere. */
  if (!href) {
    return <div className={`${CARD_CLASS} opacity-60`}>{body}</div>;
  }

  return (
    <a href={href} className={`${CARD_CLASS} ${LINK_CLASS}`}>
      {body}
    </a>
  );
}
