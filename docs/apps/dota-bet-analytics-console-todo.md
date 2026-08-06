# dota-bet-analytics-console — todo

Planned work, roughly in priority order. What the console does today is in
[dota-bet-analytics-console.md](dota-bet-analytics-console.md).

## 1. Live stream per match

Big feature, not yet scoped.

The idea is that a match page embeds the stream of the game being watched, so
the net worth graph and the game are on one screen.

Open questions to answer before starting:

- **Where does the stream come from?** `GetLiveLeagueGames` gives a league and a
  stream delay, not a channel. Some mapping from league or team to a Twitch
  channel is needed, and it may have to be maintained by hand.
- **Which language or caster** when a league has several streams.
- **An embed is client-side.** That is allowed — the rule is that no figure
  needs hydration to be readable, and `Nav` and `AutoRefresh` are already client
  components. But it should stay one leaf, not a reason to make the whole page
  a client component.
- **Stream delay is minutes long**, so the graph will be ahead of the video.
  Decide whether to delay the graph to match, or just label the difference.

## 2. Decide what the debug log tab is for

The level filter is **cumulative, not exact**: picking a level shows that level
and everything above it. So `debug` shows every event, and `info` shows
info, warn and error. The two tabs differ only by whether debug lines are
included.

On top of that, `LOG_LEVEL` defaults to `info`, and the backend rules say debug
is off in production — so in prod the debug tab usually shows exactly what the
info tab shows.

Pick one:

- **Make the filter exact**, so each tab shows only its own level. Better for
  reading one kind of event, worse for "show me everything that matters".
- **Keep it cumulative and drop the debug tab**, since it adds nothing in the
  environment the console is normally pointed at.

Either is fine. Two tabs that quietly show the same thing is not.

## 3. Log from the console itself

`ENV` and `AXIOM_DATASET` are configured in Infisical, but the app does not
depend on `@konstruct/logger` and logs nothing. The variables promise something
that is not there, and `AXIOM_TOKEN` and `AXIOM_EDGE` are missing anyway, so
nothing could reach Axiom even if the logger were installed.

Either wire it up — server logger for the route handlers and server actions, and
`/api/logs` plus the client logger if anything needs to report from the browser
— or remove the variables. Do not leave it half-configured.
