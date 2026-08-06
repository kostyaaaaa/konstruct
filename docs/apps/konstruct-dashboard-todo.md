# konstruct-dashboard — todo

Planned work. What the dashboard does today is in
[konstruct-dashboard.md](konstruct-dashboard.md).

Nothing here came from a decision yet — these are the gaps found while building
the other apps. Add real plans as they are decided.

## 1. Log from the dashboard, or stop pretending to

`ENV`, `AXIOM_DATASET` and `AXIOM_EDGE` are set in Infisical, but the app does
not depend on `@konstruct/logger` and logs nothing. `AXIOM_TOKEN` is missing, so
nothing could be sent even if it did.

Either wire it up — a server logger, plus `/api/logs` and the client logger if
anything needs to report from the browser — or remove the variables. A dataset
that never receives an event is worse than no dataset, because a search that
returns nothing looks like a healthy quiet app.

## 2. Decide what the dashboard is for beyond a list of links

Today it is a static list of apps with a name filter. Every card is an `href`
and nothing more.

Worth deciding, once there are more apps:

- Whether a card should show anything **live** — up or down, last deploy, an
  error count from that app's Axiom dataset. That turns the shell into a status
  page and gives it a reason to be opened.
- Whether apps should be grouped, once there are more than a screenful.
- Whether the routing approach changes, which is tracked in
  [../project/overview.md](../project/overview.md) rather than here because it
  affects every app.
