/**
 * Every app `pnpm dev` knows about.
 *
 * Add an entry when adding an app — `name` must match the workspace package
 * name in `apps/<name>/package.json`, and `aliases` are the short names you can
 * type instead. Both are accepted by `pnpm dev`.
 */
export const apps = [
  {
    name: 'konstruct-dashboard',
    aliases: ['dashboard'],
  },
  {
    name: 'dota-bet-analytics',
    aliases: ['dota-server', 'dota-api'],
  },
  {
    name: 'dota-bet-analytics-console',
    aliases: ['dota-console'],
  },
];

/**
 * Names that stand for several apps at once.
 *
 * A product split into a frontend and a backend is still one thing you work
 * on, so `pnpm dev dota` starts both halves. The individual aliases above
 * remain, for when you only want one.
 *
 * A group name must not collide with an app name or alias.
 */
export const groups = {
  dota: ['dota-bet-analytics', 'dota-bet-analytics-console'],
};
