# Documentation rules

Documentation is part of the change, not a follow-up task.

## 1. Code and docs ship together

Any change to code includes the documentation update it implies, in the same
turn. Never leave docs describing the previous state, and never end a task with
"docs to be updated later".

## 2. What triggers a docs update

Update docs when a change touches:

- **Structure** — new or removed package, app, or top-level folder.
- **Decisions** — package manager, framework, deployment, or any choice recorded
  in `docs/project/`. Replace the old decision; do not append a contradiction.
- **Contracts** — public APIs, shared types, env vars, config keys, commands.
- **Setup or workflow** — install, run, build, test, or release steps.
- **Conventions** — anything another contributor would otherwise guess wrong.

Pure internal refactors with no visible effect on the above need no docs change.

## 3. Where it goes

Extend the existing document that covers the topic. Create a new file only when
no current document fits, and then register it in `docs/index.md` per the rules
there. Keep documents short and current — delete text that no longer applies
rather than layering caveats on top of it.

## 4. Say what changed

When a task includes a docs update, name the updated files in the summary. If a
code change deliberately needs no docs update, say so in one line.
