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
the folder. `private: true` only stops the package being published to npm — it is
not what links it into the workspace. That comes from `pnpm-workspace.yaml`
listing `apps/*`.

Every app needs a `dev` script, because that is what `pnpm dev` runs. If it
serves HTTP, **give it its own port through a `PORT` variable in Infisical**, so
several apps can run at once. Next.js and most servers read `PORT` themselves,
so the script needs no `--port` flag:

```json
{ "dev": "infisical run --path=/<app-name> -- next dev" }
```

Ports in use: `3000` konstruct-dashboard. `dota-bet-analytics` binds nothing —
it is a worker, and a worker's `dev` script just starts the process.

The app is ESM: `"type": "module"`, `import` everywhere, and `.js` on relative
imports.

### 2. Wire up the shared configs

- An ESLint config extending the right export of `@konstruct/eslint-config`:
  `/base` for anything, `/next` for a Next.js app, `/node` for a Node service.
  A framework layer that does not exist yet becomes a **new export of the
  package**, never a config inside the app — see
  [../rules/code-style.md](../rules/code-style.md).
  Name it `eslint.config.js`; every app here is ESM.
- Prettier is inherited from the root; only add `prettier.config.js` to override.
- Install dependencies with `pnpm --filter <app-name> add <dep>`.

### 2a. Wire up secrets and logging

Secrets come from Infisical. Do not add a `.env` or a `.env.example`.

- Create a folder named after the app in the `Konstruct` Infisical project, in
  every environment it needs, and put its variables there.
- Run the app's scripts through the CLI, naming that folder:

  ```json
  { "start": "infisical run --path=/<app-name> -- node ./src/index.js" }
  ```

- `.infisical.json` already exists at the repo root and covers the whole
  workspace. Do not run `infisical init` again inside the app.
- List the variables the app needs in its document, since there is no example
  file to read them from.

Every app's Infisical folder holds these four, in every environment it runs in,
whatever else it needs:

| Variable        | Value                                                   |
| --------------- | ------------------------------------------------------- |
| `ENV`           | The environment's own name — `dev`, `staging` or `prod` |
| `AXIOM_DATASET` | **The app name.** Always. Never anything else.          |
| `AXIOM_TOKEN`   | Ingest token for that dataset                           |
| `AXIOM_EDGE`    | Regional ingest host                                    |

Plus `PORT` if it serves HTTP, and `NEXT_PUBLIC_ENV` if it is a Next.js app that
logs from the browser.

`AXIOM_DATASET` matching the app name is a rule, not a default — it means you
never have to look up where an app's logs went. Create the Axiom dataset under
that same name.

Logs go to Axiom, never to a file, and always through `@konstruct/logger`:

```bash
pnpm --filter <app-name> add @konstruct/logger --workspace
```

Usage, and why `ENV` matters for filtering, is in
[../rules/backend.md](../rules/backend.md#4-logging).

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

### 6. Add its commit scope

Add the app name to `conventionalCommits.scopes` in
[`.vscode/settings.json`](../../.vscode/settings.json):

```json
{
  "conventionalCommits.scopes": [
    "root",
    "apps",
    "packages",
    "konstruct-dashboard",
    "dota-bet-analytics"
  ]
}
```

The scope is always the app name, matching the workspace package. Without this
the extension will not offer it, and commits touching the new app end up scoped
to something vague like `apps`.

While in that file, add any new product or library names to `cSpell.words` so
the spell checker stops underlining them.

### 7. Update the places that list apps

- [`apps/README.md`](../../apps/README.md) — the app list
- [`README.md`](../../README.md) — the Apps table
- [`docs/project/structure.md`](../project/structure.md) — the tree

### 8. Verify before finishing

```bash
pnpm install                            # links the new package into the workspace
pnpm dev <alias>                        # starts
pnpm --filter <app-name> build          # if it builds
pnpm --filter <app-name> lint
pnpm format && pnpm lint
```

### 9. Deployment

A frontend gets its own project on Vercel, with **Root Directory** set to
`apps/<app-name>`. Apps deploy independently; the dashboard only links to them.

A worker cannot go on Vercel — there is no request to trigger it and nothing
keeps the process alive. It needs a host that runs a long-lived process, or a
redesign where a hosted scheduler calls it.
