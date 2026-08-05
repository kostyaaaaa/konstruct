import cron from 'node-cron';

import { flush } from '@konstruct/logger/server';

import { getLiveMatches } from './api/matches.js';
import './connectDB.js';
import { logger } from './logger.js';
import ReportService from './services/ReportService.js';
import * as matchesService from './services/matchesService.js';
import getDotaMatchAnalytics from './utils/getDotaMatchAnalytics.js';

const doHeartBeat = async () => {
  try {
    const matches = await getLiveMatches();
    const analysedMatches = await matchesService.getAllMatches();
    const liveProMatches = matches.filter((match) => {
      return match.league_id;
    });
    if (liveProMatches.length) {
      await Promise.all(
        liveProMatches.map(async (match) => {
          const foundedMatch = analysedMatches.find((m) => m.id === match.match_id);
          if (!foundedMatch) {
            logger.info('analysing match', {
              matchId: match.match_id,
              radiant: match.team_name_radiant,
              dire: match.team_name_dire,
              gameTime: match.game_time,
            });
            const matchAnalytics = await getDotaMatchAnalytics(match);
            await ReportService.sendReport(matchAnalytics);
            await matchesService.createMatch({
              id: match.match_id,
              radiantTeamName: match.team_name_radiant,
              direTeamName: match.team_name_dire,
              radiantStats: matchAnalytics.radiantStats,
              direStats: matchAnalytics.direStats,
            });
          }
        }),
      );
    }
  } catch (err) {
    logger.error('heartbeat failed', err);
  }
};

cron.schedule(
  '* * * * *', // every minute
  doHeartBeat,
);

logger.info('heartbeat started');

// Axiom sends in batches, so anything still buffered is lost unless it is
// flushed before the process goes away.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    logger.info('shutting down', { signal });
    await flush(logger);
    process.exit(0);
  });
}
