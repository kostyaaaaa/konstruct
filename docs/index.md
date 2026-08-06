# Documentation index

Entry point for all konstruct documentation. Everything imported here is in
Claude's context for the whole session, so keep imports focused and short.

## Rules for Claude

@rules/communication.md
@rules/documentation.md
@rules/code-style.md
@rules/frontend.md
@rules/backend.md

## Project

@project/overview.md
@project/structure.md

## Read on demand — not imported

- [apps/](apps/README.md) — one document per app, plus the checklist for
  [adding a new app](apps/README.md#adding-a-new-app). Read it before creating
  an app: several files have to be updated by hand, and missing one fails
  quietly. Deliberately outside the imports above — app-specific documentation
  is read when working on that app, not carried in context permanently.
- [rules/nestjs.md](rules/nestjs.md) — how to structure a NestJS app, and when
  to choose it over Express. Read it when working on a NestJS app, the same way
  an app's own document is read. One app uses NestJS today.
- [project/infrastructure.md](project/infrastructure.md) — every external
  service and core dependency, across all apps: hosting, database, secrets,
  logs, email, CI, and what is deliberately not used. Read it when adding a
  service or a dependency, or when something external is misbehaving. The
  decisions it records are summarised in `overview.md`, which is imported; the
  detail is not carried in context.

## Adding a document

1. Create the file under the matching folder (`rules/`, `project/`, or a new one).
2. Add an `@relative/path.md` import to the right section above.
   Import paths are resolved relative to the file they appear in.
3. Only import what should always be in context. Reference docs that are needed
   occasionally should be listed as plain links instead, so they are discoverable
   without being loaded every time.
