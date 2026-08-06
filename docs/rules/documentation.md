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

## 3. What not to document

Documents describe the current state, not the path to it. Git already records
the path.

Do not write:

- that something changed, or what it used to be
- why a bug was fixed, or which fix was applied
- a deviation from a design, a mockup, or an earlier plan
- a step-by-step account of work that was done

Rationale belongs in a document only when it is **not recoverable from the code**
and someone would otherwise undo it. "This value is deliberately opaque so
routing can change later" earns its place. "We changed this from centred to
left-aligned" does not — it is a commit message.

When in doubt, ask whether the sentence will still be worth reading in six
months by someone who never saw the change.

## 3a. Todo documents are the one exception

Rule 3 says documents describe the current state. **`docs/apps/<app>-todo.md`
is where the future goes instead** — one per app, listing what is planned and
why.

It is a separate file rather than a section inside the app's document, so the
app document can stay strictly about what exists. Mixing the two is how a
reader ends up implementing something that was only ever an idea.

What belongs in it:

- **The intent, not the implementation.** What should be true afterwards, and
  why it matters. Not a task breakdown.
- **What is already known**, so the work does not start from nothing — the
  constraint that makes it awkward, the endpoint that would be involved, the
  reason the obvious approach does not work.
- **Open questions**, named as questions. A plan nobody has decided yet is more
  useful written as "pick one of these two" than as a fake instruction.

What does not:

- Platform-wide decisions. Those live in `project/overview.md` under **Still
  open**, because they are not one app's to make.
- Bugs you are about to fix. Fix them.

**An item that gets done leaves the file**, and whatever it changed is written
into the app's document as current state. A todo list that keeps its completed
items becomes a changelog nobody reads.

## 4. Where it goes

Extend the existing document that covers the topic. Create a new file only when
no current document fits, and then register it in `docs/index.md` per the rules
there. Keep documents short and current — delete text that no longer applies
rather than layering caveats on top of it.

## 5. Say what changed

When a task includes a docs update, name the updated files in the summary. If a
code change deliberately needs no docs update, say so in one line.
