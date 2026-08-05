# konstruct-dashboard

The platform shell. Lists every konstruct app as a card and links into it.

## Purpose

The entry point of the platform. It does not host app functionality — it
discovers apps, lets you search them by name, and hands off. Everything it shows
comes from one static list.

## Entry point

`/` — the only route. There is no navigation beyond the cards themselves.

## Owns

- The app list: `src/data/apps.ts`, a typed `PlatformApp[]`. Adding an app to the
  dashboard means adding an entry here; nothing else discovers apps. `icon` is
  the name of a file in `src/assets/icons`.
- The visual language of the shell: colors, spacing, and the card grid, defined
  as Tailwind theme tokens in `src/app/globals.css`.

## Uses

- Next.js 16 (App Router), React 19, TypeScript.
- Tailwind CSS 4. The design's `oklch` palette lives in `@theme` as
  `--color-*` tokens, so `bg-canvas`, `text-muted`, `border-line` and friends
  are the vocabulary — avoid raw color values in components.
- `@konstruct/eslint-config/next` for linting; Prettier comes from the root.

## Run

```bash
pnpm dev dashboard                           # http://localhost:3000
pnpm --filter konstruct-dashboard build
pnpm --filter konstruct-dashboard start
pnpm --filter konstruct-dashboard lint
pnpm --filter konstruct-dashboard typecheck
```

`dev` and `start` go through `infisical run --path=/konstruct-dashboard`, so
they need the Infisical CLI and a login. `build` does not — it has no secrets to
read, and keeping it plain means CI and Vercel can build without Infisical
access.

## Configuration

Secrets live in the `Konstruct` Infisical project, in the
`/konstruct-dashboard` folder.

| Variable          | What it is                                    |
| ----------------- | --------------------------------------------- |
| `ENV`             | `dev` or `prod` — tags every log event        |
| `PORT`            | `3000`                                        |
| `AXIOM_DATASET`   | `konstruct-dashboard`                         |
| `AXIOM_TOKEN`     | Ingest token                                  |
| `AXIOM_EDGE`      | Regional ingest host                          |
| `NEXT_PUBLIC_ENV` | Same as `ENV`, but readable from browser code |

**The port is a variable, not a flag.** Next.js reads `PORT` itself, so the
scripts pass no `--port`. Changing where the dashboard runs is a change in
Infisical, not in `package.json`.

`NEXT_PUBLIC_ENV` exists because the browser cannot see `ENV` — only what the
bundler inlined. It is what tags client-side log events with the environment.
Anything prefixed `NEXT_PUBLIC_` is shipped to the browser and is therefore
public; never give a secret that prefix.

## Deploy

Vercel, with **Root Directory** set to `apps/konstruct-dashboard`. Vercel reads
the workspace from the repo root lockfile, so no extra install command is
needed. Other apps become their own Vercel projects pointing at their own root.

Vercel does not run `infisical run`. The variables above have to exist in the
Vercel project too, either entered there or synced by Infisical's Vercel
integration.

## Notes

### `href` is deliberately opaque

Each app's `href` is just a string. Today apps are separate deployments reached
by their own URL. If routing is ever consolidated under one domain — Next.js
rewrites, multi-zones, or Vercel Microfrontends — the cards do not change, only
the values do. Nothing else in the dashboard assumes where an app lives.

### One client component

`src/components/Dashboard/` is `'use client'` because search is interactive.
`src/app/page.tsx` stays a server component and passes the list down, so the app
list never ships as a fetch. Both routes prerender as static HTML.

Components follow the folder layout in
[../rules/frontend.md](../rules/frontend.md): `AppCard/`, `Dashboard/`, `Icon/`
and `LogoMark/`.

### Icons

The icons are `.svg` files in `src/assets/icons`, imported as components by
SVGR (`turbopack.rules` in `next.config.ts`, types in `src/types/svg.d.ts`) and
rendered through `Icon`, which resolves `name` to the file of the same name.
There is no icon registry: adding `rocket.svg` makes `<Icon name="rocket" />`
work, and a name with no file fails the build.

`LogoMark` is not an icon — it is a 2x2 grid of divs, so it stays a component.

### TypeScript 7

Next 16 cannot read TypeScript 7's compiler API directly, so
`experimental.useTypeScriptCli` is enabled in `next.config.ts`. Remove it when
Next supports TS 7 natively.

### Adding an app to the list

1. Add an entry to `apps` in `src/data/apps.ts`.
2. If it needs a new icon, drop the `.svg` into `src/assets/icons` and set
   `icon` to the file name. Nothing else to register.
3. Write `docs/apps/<app-name>.md` for the app itself.
