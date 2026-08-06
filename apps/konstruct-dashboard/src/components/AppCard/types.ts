import type { PlatformApp } from '@/data/apps';

export type AppCardProps = {
  app: PlatformApp;
  /** Resolved for the current environment. Null when the app has no URL yet. */
  href: string | null;
};
