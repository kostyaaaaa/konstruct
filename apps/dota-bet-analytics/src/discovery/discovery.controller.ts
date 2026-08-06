import { Controller, Get } from '@nestjs/common';

import { DiscoveryService } from './discovery.service.js';

/**
 * Worker health for the console's control screen: is it polling, when did it
 * last succeed, and did the last attempt fail.
 *
 * It lives here rather than under `/matches` so that `MatchesModule` and
 * `DiscoveryModule` do not have to import each other. Discovery already
 * depends on the registry; the reverse dependency would be a cycle, and
 * `forwardRef` would hide it rather than fix it.
 */
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('status')
  async status() {
    return this.discovery.status();
  }
}
