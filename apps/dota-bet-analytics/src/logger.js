import { createLogger } from '@konstruct/logger/server';

/**
 * The app's logger. Dataset, token, region and environment all come from the
 * Infisical folder, so there is nothing to configure here.
 */
export const logger = createLogger();
