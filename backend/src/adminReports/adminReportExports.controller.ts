import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwtAuthGuard';
import { AdminScopeGuard } from '../auth/adminScope/adminScope.guard';
import { CurrentAdminScope } from '../auth/adminScope/currentAdminScope.decorator';
import { AdminScope } from '../auth/adminScope/adminScope';
import { ReportBuilderService } from './reportBuilder.service';
import { ReportTypeParamDto } from './dto/reportTypeParamDto';

// Settings → Reports & exports, Quick export: one CSV per report for the
// caller's AdminScope. X-Export-Truncated: true means more rows matched
// than one export holds.
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, AdminScopeGuard)
export class AdminReportExportsController {
  constructor(private readonly reportBuilderService: ReportBuilderService) {}

  @Get(':reportType/export')
  async export(
    @CurrentAdminScope() scope: AdminScope,
    @Param() params: ReportTypeParamDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const report = await this.reportBuilderService.buildReport(
      scope,
      params.reportType,
    );
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.fileName}"`,
    );
    response.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Disposition, X-Export-Truncated',
    );
    response.setHeader('X-Export-Truncated', String(report.isTruncated));
    return report.csv;
  }
}
