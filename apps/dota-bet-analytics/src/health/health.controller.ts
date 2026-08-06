import { Controller, Get } from '@nestjs/common';

/**
 * Liveness only, and deliberately so: it touches nothing external, so a
 * failing check means the process is gone rather than that a query was slow.
 *
 * Worker health — last successful poll, paused or running — gets its own
 * endpoint once the workers exist.
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  check() {
    return {
      status: 'ok',
      env: process.env.ENV ?? 'unknown',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }
}
