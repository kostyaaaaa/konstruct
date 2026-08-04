# konstruct — overview

konstruct is a platform. A dashboard page is the entry point, and from there the
user navigates into distinct apps.

## Structure

- Monorepo with packages for anything shared (UI, auth, config, types, tooling).
- Each app is intended to live in its own repository.
- The dashboard is the shell that discovers and links to those apps.

## Status

Early — nothing is built yet. Package manager, framework, and the mechanism that
connects separate app repos to this monorepo are still open decisions. Update
this file as they are made.
