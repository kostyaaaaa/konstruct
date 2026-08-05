import { logger } from '../logger.js';
import axios from './config.js';

export const getTeamMatches = async (id) => {
  try {
    const result = await axios.get(`/teams/${id}/matches`);
    return result.data;
  } catch (err) {
    logger.error('getTeamMatches failed', err);
  }
};

export const getTeamHeroes = async (id) => {
  try {
    const result = await axios.get(`/teams/${id}/heroes`);
    return result.data;
  } catch (err) {
    logger.error('getTeamHeroes failed', err);
  }
};
