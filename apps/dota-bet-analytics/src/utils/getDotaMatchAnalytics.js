import { getPlayerById, getPlayerHero } from '../api/players.js';
import ALL_HEROES from '../constants/heroes.js';

const getDotaMatchAnalytics = async (match) => {
  const {
    team_id_radiant,
    team_id_dire,
    team_name_radiant,
    team_name_dire,
    radiant_score,
    dire_score,
    players,
  } = match;

  const currentRadiantPlayers = players.filter((player) => player.team_id === team_id_radiant);
  const currentDirePlayers = players.filter((player) => player.team_id === team_id_dire);

  const currentRadiantHeroes = await Promise.all(
    currentRadiantPlayers.map(async (player) => {
      const currentHero = ALL_HEROES.find((h) => h.id === player.hero_id);
      const heroName = currentHero.localized_name;
      const heroImageLink = `https://cdn.cloudflare.steamstatic.com/${currentHero.img}`;
      const heroStats = await getPlayerHero(player.account_id, player.hero_id);
      const playerStats = await getPlayerById(player.account_id);

      return { heroName, playerStats, heroStats, heroImageLink };
    }),
  );

  const currentDireHeroes = await Promise.all(
    currentDirePlayers.map(async (player) => {
      const currentHero = ALL_HEROES.find((h) => h.id === player.hero_id);
      const heroName = currentHero.localized_name;
      const heroImageLink = `https://cdn.cloudflare.steamstatic.com/${currentHero.img}`;
      const heroStats = await getPlayerHero(player.account_id, player.hero_id);
      const playerStats = await getPlayerById(player.account_id);

      return { heroName, playerStats, heroStats, heroImageLink };
    }),
  );

  const radiantWinRate = currentRadiantHeroes.reduce((acc, hero) => {
    return (+hero.heroStats.winrate || 0) + acc;
  }, 0);

  const direWinRate = currentDireHeroes.reduce((acc, hero) => {
    return (+hero.heroStats.winrate || 0) + acc;
  }, 0);

  const radiantHerosPopular = currentRadiantHeroes.reduce((acc, hero) => {
    return 100 / hero.heroStats.heroIndex + acc;
  }, 0);

  const direHerosPopular = currentDireHeroes.reduce((acc, hero) => {
    return 100 / hero.heroStats.heroIndex + acc;
  }, 0);

  const radiantStats = (+radiantWinRate * 0.8 + radiantHerosPopular * 0.2).toFixed(0);
  const direStats = (+direWinRate * 0.8 + direHerosPopular * 0.2).toFixed(0);

  return {
    team_name_radiant,
    team_name_dire,
    radiant_score,
    dire_score,
    currentRadiantHeroes,
    currentDireHeroes,
    radiantStats,
    direStats,
  };
};

export default getDotaMatchAnalytics;
