import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import type { Env } from '../config/env.schema.js';
import { AppLogger } from '../logger/logger.service.js';

/**
 * The one Mongo connection for the process.
 *
 * `forRootAsync` so the connection string is built from validated config
 * rather than read from `process.env` here — see backend.md rule 2.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService, AppLogger],
      useFactory: (config: ConfigService<Env, true>, logger: AppLogger) => {
        const user = encodeURIComponent(config.get('DB_USER', { infer: true }));
        const password = encodeURIComponent(config.get('DB_PASSWORD', { infer: true }));
        const host = config.get('DB_HOST', { infer: true });
        const name = config.get('DB_NAME', { infer: true });

        return {
          uri: `mongodb+srv://${user}:${password}@${host}/${name}?retryWrites=true&w=majority`,
          serverSelectionTimeoutMS: 15_000,

          /**
           * Connection state is otherwise invisible.
           *
           * A dropped connection shows up as query errors scattered across
           * every service; these three lines make the cause a single
           * searchable event instead.
           */
          onConnectionCreate: (connection: {
            on: (event: string, handler: (error?: Error) => void) => void;
          }) => {
            connection.on('connected', () =>
              logger.log('mongo connected', { context: 'Database', database: name }),
            );
            connection.on('disconnected', () =>
              logger.warn('mongo disconnected', { context: 'Database', database: name }),
            );
            connection.on('reconnected', () =>
              logger.log('mongo reconnected', { context: 'Database', database: name }),
            );
            connection.on('error', (error?: Error) =>
              logger.error('mongo connection error', error, {
                context: 'Database',
                database: name,
              }),
            );
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
