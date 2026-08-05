import { logger } from '../logger.js';
import axios from './config.js';

export const getPlayerHero = async (accountId, heroId) => {
  try {
    const result = await axios.get(`/players/${accountId}/heroes`);
    const playerHeroes = result.data;
    const heroIndex = playerHeroes.findIndex((h) => +h.hero_id === +heroId) + 1 || 0;
    const hero = playerHeroes.find((h) => +h.hero_id === +heroId);
    const winrate = ((hero.win / hero.games) * 100).toFixed(2);
    return { ...hero, heroIndex, winrate };
  } catch (err) {
    logger.error('getPlayerHero failed', err);
  }
};

export const getPlayerById = async (accountId) => {
  try {
    const result = await axios.get(`/players/${accountId}`);
    return result.data;
  } catch (err) {
    logger.error('getPlayerById failed', err);
  }
};
