import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../adminAuditLog/adminAuditLog.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AdminReportExportsController } from './adminReportExports.controller';
import { ScheduledReportsController } from './scheduledReports.controller';
import { ReportBuilderService } from './reportBuilder.service';
import { ReportsConfig } from './reportsConfig';
import { EmailModule } from '../email/email.module';
import { ScheduledReportsService } from './schedules/scheduledReports.service';
import { ScheduledReportsWorker } from './schedules/scheduledReports.worker';

@Module({
  imports: [AdminAuditLogModule, DashboardModule, EmailModule],
  controllers: [AdminReportExportsController, ScheduledReportsController],
  providers: [
    ReportBuilderService,
    ReportsConfig,
    ScheduledReportsService,
    ScheduledReportsWorker,
  ],
})
export class AdminReportsModule {}
