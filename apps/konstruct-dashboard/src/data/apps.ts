/**
 * The apps the dashboard links into. Static on purpose — this is the whole
 * source of truth until there are enough apps to justify fetching it.
 */

export type PlatformApp = {
  id: string;
  name: string;
  description: string;
  /**
   * Where the card points. Deliberately an opaque string: today apps are
   * separate deployments reached by their own URL, but the same field works
   * for a path under this domain if routing is ever consolidated.
   */
  href: string;
  /** File name of an SVG in `src/assets/icons`, without the extension. */
  icon: string;
};

export const apps: PlatformApp[] = [
  {
    id: 'docs',
    name: 'Docs',
    description: 'Documentation for your tools and skills, with update checks.',
    href: '#',
    icon: 'docs',
  },
  {
    id: 'dota',
    name: 'dota-bet-analytics',
    description: 'Analyzes 3D API data for betting insights.',
    href: '#',
    icon: 'chart',
  },
];
