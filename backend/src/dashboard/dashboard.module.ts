import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardConfig } from './dashboardConfig';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardConfig],
  // Reports use the same support case SLA targets.
  exports: [DashboardConfig],
})
export class DashboardModule {}
