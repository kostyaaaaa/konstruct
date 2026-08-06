import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module.js';
import { PredictionsModule } from '../predictions/predictions.module.js';
import { ReportService } from './report.service.js';

@Module({
  imports: [CommonModule, PredictionsModule],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
