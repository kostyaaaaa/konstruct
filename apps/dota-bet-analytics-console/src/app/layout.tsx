import type { Metadata } from 'next';

import { AutoRefresh } from '@/components/AutoRefresh';
import { BackToKonstruct } from '@/components/BackToKonstruct';
import { Icon } from '@/components/Icon';
import { Nav } from '@/components/Nav';

import './globals.css';

export const metadata: Metadata = {
  title: 'Dota bet analytics',
  description: 'Worker control, live matches, predictions and accuracy.',
};

const NAV = [
  { href: '/', label: 'Control' },
  { href: '/matches', label: 'Matches' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/logs', label: 'Logs' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {/* Every screen reports live state, so all of them refresh. */}
        <AutoRefresh />

        {/* Sticky, because the worker status is the reason you opened this. */}
        <header className="sticky top-0 z-10 flex h-15 items-center justify-between gap-6 border-b border-line bg-surface px-7 max-sm:gap-2.5 max-sm:px-3.5">
          <div className="flex items-center gap-4 max-sm:gap-2.5">
            <BackToKonstruct />

            {/* Separates leaving from being here. */}
            <div className="h-[22px] w-px bg-line" />

            <div className="flex items-center gap-2.5">
              <Icon name="console" size={26} className="text-accent" />
              <span className="text-[15px] font-semibold tracking-[-0.01em]">
                Dota bet analytics
              </span>
            </div>
          </div>

          <Nav items={NAV} />
        </header>

        <main className="mx-auto flex max-w-[1160px] flex-col gap-[18px] px-7 pt-7 pb-20 max-sm:px-3.5 max-sm:pt-4 max-sm:pb-14">
          {children}
        </main>
      </body>
    </html>
  );
}
