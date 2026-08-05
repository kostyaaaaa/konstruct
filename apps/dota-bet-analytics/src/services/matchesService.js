import { getMatchById } from '../api/matches.js';
import { logger } from '../logger.js';
import Match from '../models/matchesModel.js';

export const createMatch = async (data) => {
  try {
    const match = new Match(data);

    await match.save();
  } catch (err) {
    logger.error('createMatch failed', err);
  }
};

export const updateMatchById = async (data) => {
  try {
    const { winTeam, id } = data;
    await Match.findByIdAndUpdate(id, { winTeam });
  } catch (err) {
    logger.error('updateMatchById failed', err);
  }
};

export const updateAllMatches = async () => {
  try {
    const allMatches = await Match.find({});
    const matchesWithoutWinner = allMatches.filter((m) => !m.winTeam);
    await Promise.all(
      matchesWithoutWinner.map(async (m) => {
        const match = await getMatchById(m.id);
        if (match.radiant_win !== undefined) {
          await updateMatchById({
            id: m._id,
            winTeam: match.radiant_win ? m.radiantTeamName : m.direTeamName,
          });
        }
      }),
    );
  } catch (err) {
    logger.error('updateAllMatches failed', err);
  }
};

export const getAllMatches = async () => {
  try {
    const allMatches = await Match.find({});
    return allMatches;
  } catch (err) {
    logger.error('getAllMatches failed', err);
  }
};

export const getAppStats = async () => {
  try {
    const multiplier = 0.95;
    const allMatches = await Match.countDocuments({ winTeam: { $ne: '' } });
    const predictedCorrectlyMatches = await Match.countDocuments({
      $or: [
        {
          $and: [
            { winTeam: { $ne: '' } },
            {
              $expr: {
                $gt: [{ $multiply: ['$radiantStats', multiplier] }, '$direStats'],
              },
            },
            { $expr: { $eq: ['$winTeam', '$radiantTeamName'] } },
          ],
        },
        {
          $and: [
            { winTeam: { $ne: '' } },
            {
              $expr: {
                $gt: [{ $multiply: ['$direStats', multiplier] }, '$radiantStats'],
              },
            },
            { $expr: { $eq: ['$winTeam', '$direTeamName'] } },
          ],
        },
      ],
    });
    const predictedIncorrectlyMatches = await Match.countDocuments({
      $or: [
        {
          $and: [
            { winTeam: { $ne: '' } },
            {
              $expr: {
                $gt: [{ $multiply: ['$radiantStats', multiplier] }, '$direStats'],
              },
            },
            { $expr: { $eq: ['$winTeam', '$direTeamName'] } },
          ],
        },
        {
          $and: [
            { winTeam: { $ne: '' } },
            {
              $expr: {
                $gt: [{ $multiply: ['$direStats', multiplier] }, '$radiantStats'],
              },
            },
            { $expr: { $eq: ['$winTeam', '$radiantTeamName'] } },
          ],
        },
      ],
    });
    const confident = predictedCorrectlyMatches + predictedIncorrectlyMatches;
    logger.info('prediction accuracy', {
      finishedMatches: allMatches,
      confidentPredictions: confident,
      correct: predictedCorrectlyMatches,
      incorrect: predictedIncorrectlyMatches,
      accuracyPercent:
        confident > 0 ? Number(((predictedCorrectlyMatches / confident) * 100).toFixed(1)) : null,
    });
  } catch (err) {
    logger.error('getAppStats failed', err);
  }
};
