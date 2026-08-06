'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavProps } from './types';

/**
 * The only client component in the app.
 *
 * Marking the active tab needs the current path, and a layout cannot know it
 * on the server. It holds no state and handles no events — just a class that
 * depends on the URL.
 */
export function Nav({ items }: NavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6.5 max-sm:gap-3.5">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`border-b-2 pb-[19px] text-[13.5px] transition-colors max-sm:pb-[17px] max-sm:text-[12.5px] ${
              active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
