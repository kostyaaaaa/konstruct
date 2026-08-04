# App documentation

One file per app: `docs/apps/<app-name>.md`. None exist yet.

These files are **not** imported by `docs/index.md` — keeping every app's
documentation permanently in context would crowd out the rules that always
matter. Read the relevant file when working on that app.

Each app document should cover:

- **Purpose** — what the app does and who it is for
- **Entry point** — route or URL it is reached at from the dashboard
- **Owns** — its data, its packages, its external services
- **Uses** — which `@konstruct/*` packages it depends on
- **Run** — install, dev, build, test commands
- **Notes** — decisions and constraints specific to this app

Create the document in the same change that creates the app, per
[../rules/documentation.md](../rules/documentation.md).
