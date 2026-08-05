import { logger } from '../logger.js';
import axios from './config.js';

export const getLiveMatches = async () => {
  try {
    const result = await axios.get(`/live`);
    return result.data;
  } catch (err) {
    logger.error('getLiveMatches failed', err);
  }
};

export const getMatchById = async (matchId) => {
  try {
    const result = await axios.get(`/matches/${matchId}`);
    return result.data;
  } catch (err) {
    logger.error('getMatchById failed', err);
  }
};
