# Backend rules

Applies to every Node app in `apps/` that is not a frontend: HTTP APIs,
workers, and scheduled jobs.

`dota-bet-analytics` was rewritten against these rules and is the reference
implementation. Its [known weaknesses](../apps/dota-bet-analytics.md#known-weaknesses)
list what is still outstanding.

## 1. Layers, and which way they point

Three layers, and dependencies only ever point down:

```
routes / jobs      what triggers the work — HTTP handler, cron tick, CLI script
  ↓
services           the actual logic. Knows nothing about HTTP or cron.
  ↓
models / clients   the database, and wrappers around other people's APIs
```

- **A route handler stays thin.** Read the input, call one service, turn the
  result into a response. No business rules, no database queries.
- **A service never touches `req` or `res`.** It takes plain arguments and
  returns plain data. That is what makes it callable from an HTTP route, a cron
  job and a test without changes.
- **Only models talk to the database.** A query outside the model layer is a
  leak — it is the thing that makes a schema change hard later.

The same logic often needs to run from a route and from a job. That works only
if the logic sits in a service that knows about neither.

## 2. Configuration and secrets

- **Secrets come from Infisical**, injected as environment variables by
  `infisical run`. Never a committed `.env`, never a default value in code.
- **Read `process.env` once**, in a single config module, and export a typed
  object. Reaching for `process.env` deep in the code hides what an app needs
  to run.
- **Validate at startup and exit if something is missing.** An app that starts
  with a missing variable and fails on the first request is harder to debug than
  one that refuses to start.

```js
// config.js — the only file that reads process.env
const required = ['DB_URL', 'API_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}
```

- **One variable per value, and prefer whole URLs.** A connection string
  assembled from four separate parts breaks in ways that are hard to see.

## 3. Errors

The rule: **a function either returns a result or throws.** It never returns
`undefined` to mean "something went wrong".

- **Do not catch an error just to log it.** A `catch` that logs and returns
  nothing tells the caller that everything is fine. The caller then works with
  missing data and fails somewhere else, far from the cause.
- **Catch only where you can act** — retry, use a fallback, or add context and
  re-throw. Everywhere else, let it travel up.
- **One handler at the top.** An Express app has one error middleware, a worker
  has one wrapper around the job body. That is where an error becomes a response
  or a log line.
- **Add context when re-throwing**, and keep the original:

```js
throw new Error(`Failed to load match ${id}`, { cause: err });
```

- **Never swallow an error in a `Promise.all`.** One rejection rejects the
  whole thing. Use `Promise.allSettled` when partial success is genuinely
  acceptable, and then check what failed.

## 4. Logging

**Logs go to [Axiom](https://axiom.co).** Every app, from now on. Not to a
`logs/` folder, and not only to the terminal.

A log file on the machine that produced it is useless the moment there is more
than one machine, and it is gone when the process moves. Axiom keeps the events
somewhere you can search them across apps and after a restart.

- **Never write log files.** An app that opens its own file has to solve
  rotation, permissions and disk space, and usually solves none of them.
- **Also write to stdout.** Axiom is where you search; stdout is what you watch
  while developing, and what survives when Axiom cannot be reached.
- **One dataset per app**, named after the app — `dota-bet-analytics`. Do not
  share a dataset between apps: it makes every query start with a filter.
- **The token is a secret** and comes from Infisical like everything else.

**Do not wire Axiom up by hand.** `@konstruct/logger` already does it, and every
app uses it:

```bash
pnpm --filter <app> add @konstruct/logger --workspace
```

```js
// src/logger.js — one instance the whole app imports
import { createLogger } from '@konstruct/logger/server';

export const logger = createLogger();
```

```js
import { logger } from './logger.js';

logger.info('match analysed', { matchId });
logger.error('report failed', err);
```

`createLogger()` takes no arguments in normal use. Dataset, token, region and
environment all arrive as variables, so nothing about Axiom is hardcoded in an
app.

It writes to the console and, when a token is configured, to Axiom. With no
token it falls back to console only, so a machine without Axiom access still
runs — and warns about it when `NODE_ENV` is `production`.

If Axiom rejects a batch — wrong token, dataset that does not exist, network
gone — the reason is printed to the console, prefixed `[@konstruct/logger]`.
That failure cannot be logged through the logger itself, since it would be sent
to the same broken transport. Seeing that prefix means events are being
dropped.

`logger.with({ requestId })` returns a child logger that adds those fields to
every event, which is how a request or a job run stays traceable.

**A short-lived process must flush before it exits.** Axiom sends in batches, so
a cron script or a migration can exit with its last events still in memory:

```js
import { createLogger, flush } from '@konstruct/logger/server';
// ...
await flush(logger);
```

A long-running server calls the same thing on `SIGTERM`, along with closing the
database.

Four variables come with this, in every app's Infisical folder:

| Variable        | What it is                                                   |
| --------------- | ------------------------------------------------------------ |
| `ENV`           | `dev`, `staging` or `prod` — same value as the Infisical env |
| `AXIOM_DATASET` | The app's dataset name, **always equal to the app name**     |
| `AXIOM_TOKEN`   | API token, scoped to ingest into that dataset alone          |
| `AXIOM_EDGE`    | Regional ingest host, e.g. `eu-central-1.aws.edge.axiom.co`  |

**`AXIOM_DATASET` is always the app name.** `dota-bet-analytics` logs to the
`dota-bet-analytics` dataset. No exceptions, so nobody has to look up which
dataset an app writes to.

**One dataset holds every environment, separated by the `env` field.** The
logger attaches `env` to every event from `ENV`, so `env == "prod"` in Axiom
narrows a dataset to production. This is why `ENV` must be set — without it
every event is tagged `unknown` and the filter returns nothing useful.

`ENV` is not `NODE_ENV`, and both exist. `NODE_ENV` is `development` or
`production` and changes how libraries behave. `ENV` names the deployment, and
`staging` has no `NODE_ENV` equivalent.

`AXIOM_EDGE` picks the region, and there are only two values:

| Region       | Value                            |
| ------------ | -------------------------------- |
| US East 1    | `us-east-1.aws.edge.axiom.co`    |
| EU Central 1 | `eu-central-1.aws.edge.axiom.co` |

Find which one your organisation uses in the Axiom console under
**Settings → General → Edge deployment**. It is optional — leave it unset and
the client uses Axiom's default endpoint. A regional hostname must not go in
`url`, which is for non-ingest calls only.

### What to log

The target is that a question about production can be answered from Axiom
alone, without adding logging and waiting for it to happen again.

- **One `info` per completed step of work** — a match discovered, a prediction
  made, a report sent, a sync finished. Not per function call.
- **`warn` for anything degraded but survivable** — a retry, a missing player's
  stats, a duplicate write, a value falling back to a default.
- **`error` for work that did not happen**, with the `Error` passed so the
  stack and name are kept.
- **`debug` for per-tick detail** — one line summarising each poll. Off in
  production, invaluable when something is wrong.

Every line carries a `context` naming the part of the app it came from, so
`['fields.context'] == "Discovery"` narrows to one worker.

### Message first, fields second

`logger.info('match analysed', { matchId })` — not
``logger.info(`match ${matchId} analysed`)``. A field can be filtered, grouped
and counted; a value glued into a sentence can only be substring-searched.

Keep the message a **fixed string**. Variable text in the message means the
same event reads as many different events, and counting them becomes
impossible.

### Failures in shared helpers need a way out

A retry loop inside a plain function has no logger. Give it a callback the
caller supplies rather than reaching for a global — `fetchJson` takes an
observer, and one shared implementation turns those into log lines. Without
it, a rate-limit storm is completely invisible: the caller only ever sees the
final result.

**Redact secrets that live in URLs.** Steam puts the API key in the query
string, so anything logging a URL strips it first.

### A silent process is indistinguishable from a dead one

**Every long-running worker logs a heartbeat, once a minute, whether or not it
did anything.** One `info` line with what it has done since the last one —
ticks completed, failures, whatever it is watching.

This breaks the "one `info` per completed step" rule above on purpose. Without
it, a healthy idle process and a wedged one both log nothing, and the only way
to ask "was it running an hour ago" is to reconstruct the answer from database
side effects. That is not an answer you can get during an incident.

**An HTTP app also logs one line per request**, on `finish` so the status and
duration are real. A request that never completes never logs, which is the
signal. Health checks belong at `debug` — they are constant and would bury
everything else — and the query string is never logged, because that is where
an API key sits.

- **Levels mean something.** `error` is something a person must look at.
  `warn` is unexpected but handled. `info` is a normal milestone. `debug` is off
  in production.
- **Never log a secret**, a token, a password, or a full request body that might
  hold one. Axiom keeps what you send it.

## 5. HTTP APIs

Two frameworks are allowed, and the choice is made per app and written into that
app's document:

- **Express** — small apps, and workers that only need a health endpoint.
- **NestJS** — apps with many endpoints, where structure is worth enforcing.
  Its own rules are in [nestjs.md](nestjs.md), read when working on such an app.

One app uses one framework. The rules below hold for both; NestJS just provides
its own tools for them.

- **Validate every input at the edge** — body, query and params — with a schema
  (zod or similar), before it reaches a service. Everything from outside is
  untrusted, including data from another one of our apps.
- **Correct status codes.** `400` the client sent something wrong, `401` not
  authenticated, `403` authenticated but not allowed, `404` no such thing, `409`
  conflict, `500` we broke. Not `200` with an error inside.
- **Async handlers need their errors forwarded.** Express 4 does not catch a
  rejected promise — wrap handlers or use a library, or the request hangs.
  Express 5 forwards them itself.
- **Set the basics**: `helmet` for headers, explicit CORS origins rather than
  `*`, a body size limit, and rate limiting on anything public or expensive.
- **Health endpoint.** `GET /health` returns cheaply and does not depend on the
  database, so a failing check means the process is gone, not that a query was
  slow.
- **Shut down gracefully.** On `SIGTERM`, stop accepting connections, let
  in-flight requests finish, close the database, then exit.

## 6. Databases

- **The schema is written down**, in the model file for MongoDB or in a
  migration for SQL. Required fields are required, and defaults live in the
  schema rather than being applied by hand at each call site.
- **Index what you query.** A field used in a filter or a sort needs an index.
  Without one the query works fine on a small collection and falls over on a
  large one.
- **Ask for what you need.** Filter in the query, not in JavaScript after
  loading everything. Select the fields you use. Paginate any list that can
  grow.
- **Never build a query from string concatenation.** Parameters and query
  builders exist to stop injection.
- **Writes that must happen together happen in a transaction.** If that is not
  possible, make the operation safe to repeat, so a retry cannot double-apply
  it.
- **Migrations are files, committed and run in order.** Changing a production
  schema by hand leaves environments that quietly differ.
- **One connection pool for the process**, opened at startup and closed on
  shutdown. Not a connection per request.

## 7. Jobs and workers

- **A job is a service call with a trigger.** The scheduler decides _when_; it
  should not know _what_.
- **Jobs are idempotent.** The same tick running twice must not send two emails
  or write two rows. Check for the work already being done, or key the write so
  a repeat is harmless.
- **Stop runs from overlapping.** A job scheduled every minute that sometimes
  takes two will run on top of itself. Guard with a flag or a lock.
- **Every job body has its own try/catch.** One failed tick must not kill the
  process or stop the schedule.
- **Talk to other people's APIs carefully** — a timeout on every call, retries
  with a growing delay, and a cap on how many run at once. No retry at all means
  one blip loses the work; no limit means a burst of parallel calls gets the app
  rate-limited.

## 8. Dependencies

- Add a dependency when it does real work. Remove it the moment nothing imports
  it — an unused package is install time, disk, and one more thing to audit.
- Install scripts stay blocked. `allowBuilds` in `pnpm-workspace.yaml` is the
  list of reviewed exceptions, and each entry says why.
- A deprecated package is a problem to schedule, not to ignore.
