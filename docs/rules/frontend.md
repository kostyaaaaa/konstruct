# Frontend rules

Applies to every frontend app in `apps/`. Node apps that are not frontends
follow [backend.md](backend.md) instead.

Logging is shared with the backend: events go to Axiom through
`@konstruct/logger`, one dataset per app. See
[backend.md](backend.md#4-logging), and rule 7 below for the browser side.

## 1. One folder per component

A component is a folder, not a file. The folder, the component, and the file all
carry the same name.

```
src/components/AppCard/
├── AppCard.tsx      # the component
├── types.ts         # its props and any types only it uses
└── index.ts         # export * from './AppCard'
                     # export * from './types'
```

- **`index.ts` is the only entry point.** Import from the folder
  (`@/components/AppCard`), never reach into the file (`.../AppCard/AppCard`).
- **`types.ts` only when there is something to put in it.** A component with no
  props does not get an empty file.
- **A styles file only when styles cannot live in the markup.** With Tailwind
  they belong in `className`, so no styles file — this is for an app that uses
  CSS Modules or similar.

Closely related components that are always used together may share one folder
behind a single `index.ts`. Use this sparingly; the default is one folder per
component.

## 2. Naming

- **Components** — `PascalCase`, matching the folder: `AppCard`, `LogoMark`.
- **Component files** — `PascalCase.tsx`, matching the component.
- **Everything else** — `camelCase.ts` for modules (`apps.ts`, `types.ts`,
  `index.ts`), and whatever the framework dictates for special files
  (`page.tsx`, `layout.tsx`, `globals.css`).
- **Props types** — `<Component>Props`, exported from the component's
  `types.ts`.

## 3. Server components by default

In the App Router, a component is a server component unless it needs the client.
Add `'use client'` only for state, effects, browser APIs or event handlers, and
add it as far down the tree as possible — one interactive leaf should not turn a
whole route into client code.

Keep route files (`page.tsx`, `layout.tsx`) as server components. When a page
needs interactivity, it renders a client component and passes data down.

## 4. Styling

Tailwind is the default for frontend apps.

- Design tokens go in `@theme` in the app's `globals.css`; components use the
  token utilities (`bg-canvas`, `text-muted`, `border-line`) rather than raw
  color values.
- Arbitrary values (`text-[13.5px]`) are fine when matching a design exactly.
  A value used more than twice should become a token instead.
- No inline `style` attributes for anything Tailwind can express.

## 5. Assets

Every icon, image and other static asset lives in `src/assets/`, by kind:

```
src/assets/
└── icons/
    ├── chart.svg
    ├── docs.svg
    └── search.svg
```

Files stay in their real format — `.svg` as SVG, `.png` as PNG — so an export
from a design tool or an icon set drops straight in.

### Icons go through one Icon component

SVGs are never inlined as JSX in a component. `src/assets/icons/*.svg` are
imported as React components (SVGR, configured in `next.config.ts`) and reached
through a single `Icon`:

```tsx
<Icon name="docs" size={22} className="text-brand-ink" />
```

**`name` is the file name.** `name="docs"` resolves `src/assets/icons/docs.svg`,
so adding an icon means dropping the file in — there is no registry to update
and no union to extend. The lookup is a template-literal `import()`, which the
bundler turns into one chunk per icon.

A name with no matching file throws
`Icon "<name>" not found. Expected src/assets/icons/<name>.svg`. On a
statically prerendered page that surfaces at build time, so a typo fails the
build rather than shipping a blank square. On a page rendered at request time it
surfaces at runtime — the tradeoff for not maintaining a typed list.

Author icons with `stroke="currentColor"` (or `fill="currentColor"`) and no
hard-coded size, so color comes from a Tailwind text utility and size from the
`size` prop. Note that SVGR optimizes on import — shapes may be merged into a
single `<path>`, which changes the markup but not the geometry.

An asset that is genuinely part of a component's own markup — a decorative
shape built from divs, for instance — stays a component instead.

## 6. Data and types

- Static data lives in a typed module under `src/data/`, exported with an
  explicit type. It is not fetched, and it is not duplicated in components.
- Types shared by several components live next to the data or in `src/types/`;
  types used by one component live in that component's `types.ts`.

## 7. Logging from the browser

A frontend has two places that log, and they are not the same.

- **Server components, route handlers, server actions** — use
  `@konstruct/logger/server`, exactly like a backend.
- **Client components** — use `@konstruct/logger/client`.

```tsx
'use client';
import { createClientLogger } from '@konstruct/logger/client';

const logger = createClientLogger();
logger.error('search failed', { query });
```

**The client logger takes no token, and that is the point.** An Axiom ingest
token shipped to the browser is readable by anyone who opens the network tab,
and it lets them write into your dataset. So the browser posts its events to a
route in your own app, and that route — running on the server, where the token
lives — forwards them.

That means a client logger needs the route to exist. Add one at `/api/logs`
(the default `url`) that reads the batch from the request and passes it to a
server logger. Without it the events go to the console and the posts fail.

The browser cannot read `ENV` either — it only sees what the bundler inlined. To
tag browser events with the environment, publish it as `NEXT_PUBLIC_ENV`, which
the client logger picks up. Otherwise pass `env` to `createClientLogger`
explicitly. Without either, browser events are tagged `unknown`.

Log from the browser sparingly. It is for things the server cannot see — a
render error, a failed fetch, an interaction that broke. Not page views, and
never anything a user typed.
