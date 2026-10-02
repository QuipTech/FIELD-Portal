import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { AuditLogService } from './auditLog.service';
import {
  AuditLogFilterQueryDto,
  ListAuditLogQueryDto,
} from './dto/listAuditLogQueryDto';

// Audit events for the caller's AdminScope (every organisation for the
// Owner).
@Controller('admin/auditLog')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(
    @CurrentAdminScope() scope: AdminScope,
    @Query() query: ListAuditLogQueryDto,
  ) {
    return this.auditLogService.listEvents(scope, query);
  }

  // Options for the Actor and Action filters.
  @Get('filters')
  listFilters(@CurrentAdminScope() scope: AdminScope) {
    return this.auditLogService.listFilters(scope);
  }

  // Same filters as the list, no paging. X-Export-Truncated: true means
  // more events matched than one export holds.
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  @Header(
    'Access-Control-Expose-Headers',
    'Content-Disposition, X-Export-Truncated',
  )
  async export(
    @CurrentAdminScope() scope: AdminScope,
    @Query() filters: AuditLogFilterQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { csv, isTruncated } = await this.auditLogService.exportCsv(
      scope,
      filters,
    );
    response.setHeader('X-Export-Truncated', String(isTruncated));
    return csv;
  }
}
