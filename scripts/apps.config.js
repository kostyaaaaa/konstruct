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
];
