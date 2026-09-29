import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { RequireRolesGuard } from '../auth/guards/requireRoles.guard';
import { RequireRoles } from '../auth/decorators/requireRoles.decorator';
import { OWNER_ROLE_NAME } from '../auth/systemRoleNames';
import { AuditLogService } from './auditLog.service';
import {
  AuditLogFilterQueryDto,
  ListAuditLogQueryDto,
} from './dto/listAuditLogQueryDto';

// Every organisation's audit events — Owner only.
@Controller('admin/auditLog')
@UseGuards(JwtAuthGuard, RequireRolesGuard)
@RequireRoles(OWNER_ROLE_NAME)
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(@Query() query: ListAuditLogQueryDto) {
    return this.auditLogService.listEvents(query);
  }

  // Options for the Actor and Action filters.
  @Get('filters')
  listFilters() {
    return this.auditLogService.listFilters();
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
    @Query() filters: AuditLogFilterQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { csv, isTruncated } = await this.auditLogService.exportCsv(filters);
    response.setHeader('X-Export-Truncated', String(isTruncated));
    return csv;
  }
}
