'use client';

import { useMemo, useState } from 'react';

import { AppCard } from '@/components/AppCard';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/LogoMark';

import type { DashboardProps } from './types';

export function Dashboard({ apps }: DashboardProps) {
  const [query, setQuery] = useState('');

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? apps.filter((app) => app.name.toLowerCase().includes(q)) : apps;
  }, [apps, query]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 flex h-18 items-center justify-between gap-2.5 border-b border-line bg-surface px-4 sm:gap-6 sm:px-10">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div className="text-lg font-semibold tracking-[-0.01em]">Konstruct</div>
        </div>

        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-transparent bg-field px-3.5 py-2.25 transition-colors duration-150 focus-within:border-line-strong sm:w-70 sm:flex-none">
          <Icon name="search" size={16} className="shrink-0 text-muted" />
          <input
            type="text"
            placeholder="Search apps"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full min-w-0 border-none bg-transparent font-sans text-sm text-ink outline-none"
          />
        </label>
      </header>

      <main className="max-w-290 px-4 pt-6 pb-14 sm:px-10 sm:pt-12 sm:pb-20">
        {filteredApps.length > 0 ? (
          <div className="grid grid-cols-1 gap-5.5 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-sm text-muted">
            No apps match &quot;{query}&quot;
          </div>
        )}
      </main>
    </div>
  );
}
