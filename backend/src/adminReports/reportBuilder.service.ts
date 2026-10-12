import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import { DashboardConfig } from '../dashboard/dashboardConfig';
import { AuditLogService } from '../adminAuditLog/auditLog.service';
import * as reportsRepository from './reports.repository';
import {
  toAiUsageCsv,
  toCasesSlaCsv,
  toFleetUptimeCsv,
} from './csv/toReportCsv';
import { REPORT_PERIOD_DAYS, ReportFile, ReportType } from './types/reportType';

const DAY_MS = 24 * 60 * 60 * 1000;

const FILE_PREFIXES: Record<ReportType, string> = {
  fleet_uptime: 'fleet-uptime',
  cases_sla: 'cases-sla',
  ai_usage: 'ai-usage',
  audit_log: 'audit-log',
};

// Builds one report as CSV, for a quick export or a scheduled email.
// Each covers the last REPORT_PERIOD_DAYS days.
@Injectable()
export class ReportBuilderService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dashboardConfig: DashboardConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  buildReport = async (
    scope: AdminScope,
    reportType: ReportType,
    now: Date = new Date(),
  ): Promise<ReportFile> => {
    const { csv, isTruncated } = await this.buildCsv(scope, reportType, now);
    const day = now.toISOString().slice(0, 10);
    return {
      fileName: `${FILE_PREFIXES[reportType]}-${day}.csv`,
      csv,
      isTruncated,
    };
  };

  private buildCsv = async (
    scope: AdminScope,
    reportType: ReportType,
    now: Date,
  ): Promise<{ csv: string; isTruncated: boolean }> => {
    const since = new Date(now.getTime() - REPORT_PERIOD_DAYS * DAY_MS);
    switch (reportType) {
      case 'fleet_uptime': {
        const rows = await reportsRepository.listFleetUptime(
          this.databaseService,
          scope,
          since,
        );
        return { csv: toFleetUptimeCsv(rows), isTruncated: false };
      }
      case 'cases_sla': {
        const rows = await reportsRepository.listCases(
          this.databaseService,
          scope,
          since,
        );
        const csv = toCasesSlaCsv(rows, this.dashboardConfig.slaHours, now);
        return { csv, isTruncated: false };
      }
      case 'ai_usage': {
        const rows = await reportsRepository.listAiUsage(
          this.databaseService,
          scope,
          REPORT_PERIOD_DAYS,
        );
        return { csv: toAiUsageCsv(rows), isTruncated: false };
      }
      case 'audit_log':
        return this.auditLogService.exportCsv(scope, {
          from: since.toISOString(),
        });
    }
  };
}
