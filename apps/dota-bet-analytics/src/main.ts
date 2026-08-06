import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { AppLogger } from './logger/logger.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  /* Lets Nest run module shutdown hooks on SIGTERM, which is what gives the
     workers and the logger a chance to finish rather than being killed. */
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 5001);
  await app.listen(port);

  logger.log('api listening', { context: 'Bootstrap', port, env: process.env.ENV });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void (async () => {
        await app.close();
        await logger.flush();
        process.exit(0);
      })();
    });
  }
}

void bootstrap();
