# Documentation index

Entry point for all konstruct documentation. Everything imported here is in
Claude's context for the whole session, so keep imports focused and short.

## Rules for Claude

@rules/communication.md
@rules/documentation.md
@rules/code-style.md

## Project

@project/overview.md
@project/structure.md

## Read on demand — not imported

- [apps/](apps/README.md) — one document per app. Deliberately outside the
  imports above: app-specific documentation is read when working on that app,
  not carried in context permanently.

## Adding a document

1. Create the file under the matching folder (`rules/`, `project/`, or a new one).
2. Add an `@relative/path.md` import to the right section above.
   Import paths are resolved relative to the file they appear in.
3. Only import what should always be in context. Reference docs that are needed
   occasionally should be listed as plain links instead, so they are discoverable
   without being loaded every time.
