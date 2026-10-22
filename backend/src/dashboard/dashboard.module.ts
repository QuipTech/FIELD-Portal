import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardConfig } from './dashboardConfig';
import { AdminDashboardService } from './adminDashboard.service';
import { KnowledgeAccessModule } from '../knowledgeCatalog/access/knowledgeAccess.module';

@Module({
  imports: [KnowledgeAccessModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardConfig, AdminDashboardService],
  // Reports use the same support case SLA targets.
  exports: [DashboardConfig],
})
export class DashboardModule {}
