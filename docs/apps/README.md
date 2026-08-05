# App documentation

One file per app: `docs/apps/<app-name>.md`.

These files are **not** imported by `docs/index.md` — keeping every app's
documentation permanently in context would crowd out the rules that always
matter. Read the relevant file when working on that app.

Each app document should cover:

- **Purpose** — what the app does and who it is for
- **Entry point** — route or URL it is reached at from the dashboard
- **Owns** — its data, its packages, its external services
- **Uses** — which `@konstruct/*` packages it depends on
- **Run** — install, dev, build, test commands
- **Deploy** — where it is hosted and how
- **Notes** — decisions and constraints specific to this app

## Adding a new app

Nothing discovers apps automatically. Every step below is a place that has to be
told the app exists, and skipping one fails quietly — an app that builds fine but
`pnpm dev` cannot find, or one the dashboard never links to.

### 1. Create the workspace package

`apps/<app-name>/package.json`, `private: true`, with the package `name` matching
the folder. Give it a `dev` script that **pins its own port**, so several apps can
run at once:

```json
{ "scripts": { "dev": "next dev --port 3001" } }
```

Ports in use: `3000` konstruct-dashboard.

### 2. Wire up the shared configs

- `eslint.config.js` extending `@konstruct/eslint-config/base`, or `/next` for a
  Next.js app. A framework layer that does not exist yet becomes a **new export
  of the package**, never a config inside the app — see
  [../rules/code-style.md](../rules/code-style.md).
- Prettier is inherited from the root; only add `prettier.config.js` to override.
- Install dependencies with `pnpm --filter <app-name> add <dep>`.

### 3. Register it for `pnpm dev`

Add an entry to [`scripts/apps.config.js`](../../scripts/apps.config.js):

```js
export const apps = [
  { name: 'konstruct-dashboard', aliases: ['dashboard'] },
  { name: 'dota-bet-analytics', aliases: ['dota'] },
];
```

`name` matches the workspace package name; `aliases` are the short names
`pnpm dev` also accepts. Give every app an alias — this file is the only place
that knows apps exist.

### 4. Add it to the dashboard

The dashboard's list is `apps/konstruct-dashboard/src/data/apps.ts`. Add an
entry, and drop an icon into its `src/assets/icons` if the app needs a new one.
Details in [konstruct-dashboard.md](konstruct-dashboard.md).

### 5. Write its document

`docs/apps/<app-name>.md`, covering the sections listed above. Same change as the
code, per [../rules/documentation.md](../rules/documentation.md).

### 6. Update the places that list apps

- [`apps/README.md`](../../apps/README.md) — the app list
- [`README.md`](../../README.md) — the Apps table
- [`docs/project/structure.md`](../project/structure.md) — the tree
- `.vscode/settings.json` — add the app to `conventionalCommits.scopes`

### 7. Verify before finishing

```bash
pnpm dev <alias>                        # starts on its own port
pnpm --filter <app-name> build
pnpm --filter <app-name> lint
pnpm format && pnpm lint
```

### 8. Deployment

Its own project on Vercel, with **Root Directory** set to `apps/<app-name>`.
Apps deploy independently; the dashboard only links to them.
