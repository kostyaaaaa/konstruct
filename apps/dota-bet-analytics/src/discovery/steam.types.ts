/**
 * The parts of `GetLiveLeagueGames` this app reads.
 *
 * Deliberately partial and fully optional below the top level: Valve changes
 * response shapes without notice, and `server_steam_id` has already vanished
 * from this payload once. Everything is validated before use rather than
 * trusted.
 */

export interface SteamTeam {
  team_name?: string;
  team_id?: number;
  team_logo?: number;
}

export interface SteamScoreboardSide {
  score?: number;
  tower_state?: number;
  barracks_state?: number;
  picks?: { hero_id: number }[];
  bans?: { hero_id: number }[];
  players?: {
    account_id?: number;
    hero_id?: number;
    kills?: number;
    death?: number;
    assists?: number;
    net_worth?: number;
    gold?: number;
    level?: number;
  }[];
}

export interface SteamScoreboard {
  duration?: number;
  roshan_respawn_timer?: number;
  radiant?: SteamScoreboardSide;
  dire?: SteamScoreboardSide;
}

export interface SteamLiveGame {
  match_id?: number;
  lobby_id?: string;
  league_id?: number;
  radiant_team?: SteamTeam;
  dire_team?: SteamTeam;
  radiant_series_wins?: number;
  dire_series_wins?: number;
  series_type?: number;
  spectators?: number;
  stream_delay_s?: number;
  scoreboard?: SteamScoreboard;
}

export interface GetLiveLeagueGamesResponse {
  result?: { games?: SteamLiveGame[] };
}
