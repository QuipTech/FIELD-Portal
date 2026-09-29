import { Module } from '@nestjs/common';
import { AdminAuditLogController } from './adminAuditLog.controller';
import { AuditLogService } from './auditLog.service';

@Module({
  controllers: [AdminAuditLogController],
  providers: [AuditLogService],
})
export class AdminAuditLogModule {}
