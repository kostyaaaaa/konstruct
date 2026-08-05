import mongoose from 'mongoose';

import { logger } from './logger.js';

const { DB_HOST, DB_PASSWORD, DB_USER, DB_NAME } = process.env;

async function connect() {
  try {
    await mongoose.connect(
      `mongodb+srv://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}?retryWrites=true&w=majority`,
    );
    logger.info('mongodb connected', { database: DB_NAME });
  } catch (error) {
    logger.error('mongodb connection failed', error);
  }
}

connect();
