import type { Metadata } from 'next';

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
        {/* Sticky, because the worker status is the reason you opened this. */}
        <header className="sticky top-0 z-10 flex h-15 items-center justify-between gap-6 border-b border-line bg-surface px-7">
          <div className="flex items-center gap-4">
            <BackToKonstruct />

            {/* Separates leaving from being here. */}
            <div className="h-[22px] w-px bg-line" />

            <div className="flex items-center gap-2.5">
              <Icon name="console" size={20} className="text-accent" />
              <span className="text-[15px] font-semibold tracking-[-0.01em]">
                Dota bet analytics
              </span>
            </div>
          </div>

          <Nav items={NAV} />
        </header>

        <main className="mx-auto flex max-w-[1160px] flex-col gap-[18px] px-7 pt-7 pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}
