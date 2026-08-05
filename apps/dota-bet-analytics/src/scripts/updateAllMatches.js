import mongoose from 'mongoose';

import { flush } from '@konstruct/logger/server';

import '../connectDB.js';
import { logger } from '../logger.js';
import { updateAllMatches } from '../services/matchesService.js';

mongoose.connection.on('open', async () => {
  await updateAllMatches();
  await mongoose.connection.close();
  // One-shot script: without this the last events never leave the process.
  await flush(logger);
});
