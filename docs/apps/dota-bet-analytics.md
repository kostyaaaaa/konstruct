# dota-bet-analytics

A background worker. It watches live Dota 2 professional matches, scores both
teams, and emails a report for each new match it finds.

## Purpose

Betting support, for one reader. Every minute it asks the Dota API which matches
are live. For a professional match it has not seen before, it builds a score for
each side from how the ten players historically perform on the heroes they are
currently playing, emails that as an HTML report, and stores the match.

Later, a separate script fills in who actually won, which turns the stored
matches into a record of how good the scoring is.

## Entry point

None. This app has no HTTP server and no UI — it is a cron process, not a site.

The dashboard card points at `#` for that reason. There is nothing to open in a
browser, and there will not be until the app grows an interface.

## Owns

- **The score.** `src/utils/getDotaMatchAnalytics.js` turns a live match into
  two numbers, `radiantStats` and `direStats`. For each player it takes the win
  rate on the hero they are playing and how high that hero sits in their most
  played list, then weights them 80/20. This is the whole prediction.
- **The match record.** One MongoDB collection, `Matches`, defined in
  `src/models/matchesModel.js`: the two team names, the two scores, and
  `winTeam`, which is empty until the update script fills it in.
- **The report.** `src/templates/dotaReport.hbs`, a Handlebars template
  rendered to HTML and sent by email.
- **The hero list.** `src/constants/heroes.js`, a static copy of every Dota
  hero with its id, name and portrait path. It is updated by hand when Valve
  adds a hero.

## Uses

- **Node, ESM.** `"type": "module"`, so every file uses `import`. Relative
  imports carry the `.js` extension, which ESM requires.
- **An external Dota API** at `DOTA_API_URL`, through four endpoints: `/live`,
  `/matches/:id`, `/players/:id`, `/players/:id/heroes`. `src/api/` is a thin
  axios wrapper per resource.
- **MongoDB Atlas** through mongoose. The connection string is assembled from
  four separate variables in `src/connectDB.js`.
- **Gmail SMTP** through nodemailer, to send the report.
- **node-cron** for the every-minute heartbeat.
- `@konstruct/logger` for logging — `src/logger.js` creates the one instance the
  app shares. Nothing is configured there; the dataset, token, region and
  environment all arrive as variables.
- `@konstruct/eslint-config/node` for linting; Prettier comes from the root.

## Run

Secrets come from Infisical, so every script goes through `infisical run`. See
[Configuration](#configuration) below for the one-time setup.

```bash
pnpm dev dota                              # heartbeat under nodemon
pnpm --filter dota-bet-analytics start     # heartbeat under plain node
pnpm --filter dota-bet-analytics stats     # print prediction accuracy
pnpm --filter dota-bet-analytics update    # backfill winners for stored matches
pnpm --filter dota-bet-analytics lint
```

`stats` and `update` are one-shot: they connect, do their work, close the
connection, and flush the logger so the last events actually reach Axiom.

The long-running heartbeat flushes on `SIGINT` and `SIGTERM` for the same
reason.

## Configuration

Secrets live in the `Konstruct` Infisical project, in the
**`/dota-bet-analytics`** folder, and are injected as environment variables.
Nothing is read from a committed file.

Every script passes `--path=/dota-bet-analytics`, so the app only ever sees its
own folder. The environment defaults to `dev`; add `--env=prod` to switch.

| Variable        | What it is                             |
| --------------- | -------------------------------------- |
| `ENV`           | `dev` or `prod` — tags every log event |
| `DOTA_API_URL`  | Base URL of the Dota API               |
| `DB_HOST`       | MongoDB Atlas host                     |
| `DB_USER`       | MongoDB user                           |
| `DB_PASSWORD`   | MongoDB password                       |
| `DB_NAME`       | Database name                          |
| `SMTP_EMAIL`    | Gmail account the report is sent from  |
| `SMTP_PASSWORD` | App password for that account          |
| `EMAIL`         | Address the report is sent to          |
| `AXIOM_DATASET` | `dota-bet-analytics`                   |
| `AXIOM_TOKEN`   | Ingest token                           |
| `AXIOM_EDGE`    | Regional ingest host                   |

`dev` and `prod` are populated. `staging` is empty; the app has never run there.

There is no `.env` and no `dotenv`. Infisical is the only source, so a script
run without `infisical run` starts with nothing configured.

Setup is workspace-wide and done once from the repo root, not per app:
see [Secrets](../../README.md#secrets).

## Deploy

Not deployed. It has only ever run locally.

It cannot go on Vercel as-is: Vercel runs functions in response to requests, and
this app is a process that must stay alive to hold its cron timer. It needs a
host that runs a long-lived process — Railway, Fly.io, or a small VM — or it has
to be rebuilt so that a hosted scheduler calls a function every minute instead of
`node-cron` holding the timer itself.

## Notes

### The scoring is unvalidated

`stats` compares each stored prediction to the real winner, but only counts
matches where one side's score beats the other's by more than 5%. Everything
closer than that is left out of the total. Read the printed accuracy with that
in mind — it describes the confident predictions, not all of them.

### Known weaknesses

The code predates this repo. Logging, module format and configuration have been
brought in line with the rules; the rest has not. These are the parts worth
knowing about before changing anything:

- **Errors are swallowed.** Almost every function catches its own error, logs
  it, and returns `undefined`. The caller cannot tell failure from an empty
  result, so a failed API call silently becomes a report built from missing
  data. This breaks [backend.md rule 3](../rules/backend.md#3-errors) and is the
  biggest thing left.
- **No retries and no rate limiting.** A match with ten players fires twenty API
  calls at once, and a single failure is lost rather than retried.
- **The heartbeat re-reads every stored match every minute** to check whether the
  current live match is new, instead of querying for the one id.
- **Overlapping runs are not guarded.** The cron fires every minute whether or
  not the previous run has finished.
- **`src/responseExamples/` is dead code** — five files of sample API payloads
  that nothing imports. Useful as a reference for the shapes the Dota API
  returns, which is the only reason they are still here.

These are listed so nobody assumes they are deliberate. Fixing them is app work,
not documentation work.

### The Atlas cluster is unreachable

`DB_HOST` points at a cluster whose DNS record does not resolve — an SRV lookup
returns `NXDOMAIN`, not a timeout, so the name genuinely does not exist. The
app therefore cannot connect, and nothing that touches the database has been
run end to end since the move into this repo.

Free Atlas clusters are deleted after long inactivity, and this project sat
untouched from 2023. Creating a new cluster and updating the four `DB_*`
variables in Infisical is what unblocks it.
