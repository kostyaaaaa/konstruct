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
