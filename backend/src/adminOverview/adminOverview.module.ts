import { Module } from '@nestjs/common';
import { AdminAuditLogModule } from '../adminAuditLog/adminAuditLog.module';
import { AdminOverviewController } from './adminOverview.controller';
import { AdminOverviewService } from './adminOverview.service';

@Module({
  imports: [AdminAuditLogModule],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService],
})
export class AdminOverviewModule {}
