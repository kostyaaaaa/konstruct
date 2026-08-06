import type { PlatformApp } from '@/data/apps';

/** An app with its URL already resolved for the current environment. */
export type DashboardEntry = {
  app: PlatformApp;
  href: string | null;
};

export type DashboardProps = {
  entries: DashboardEntry[];
};
