/**
 * The apps the dashboard links into. Static on purpose — this is the whole
 * source of truth until there are enough apps to justify fetching it.
 */

/** Environments an app can have a URL in. Matches Infisical's `ENV`. */
export type AppEnv = 'dev' | 'staging' | 'prod';

export type PlatformApp = {
  id: string;
  name: string;
  description: string;
  /**
   * Where the card points, per environment.
   *
   * Deliberately a map of opaque strings: in dev an app is on localhost, in
   * prod it is wherever it was deployed, and those move independently. An
   * environment with no entry yet renders as a card that is not a link, rather
   * than one that goes nowhere.
   */
  href: Partial<Record<AppEnv, string>>;
  /** File name of an SVG in `src/assets/icons`, without the extension. */
  icon: string;
};

export const apps: PlatformApp[] = [
  {
    id: 'docs',
    name: 'Docs',
    description: 'Documentation for your tools and skills, with update checks.',
    href: {},
    icon: 'docs',
  },
  {
    id: 'dota',
    name: 'dota-bet-analytics',
    description: 'Live tier 1-2 Dota 2 match tracking, predictions and their accuracy.',
    href: {
      dev: 'http://localhost:4000',
      prod: 'https://konstruct-dota-bet-analytics-consol.vercel.app',
    },
    icon: 'dota',
  },
];

/**
 * The URL for an app in the current environment, or null when it has none.
 *
 * Null is a real state, not a bug: an app can exist and be listed before it is
 * deployed anywhere.
 */
export function resolveHref(app: PlatformApp, env: AppEnv): string | null {
  return app.href[env] ?? null;
}
