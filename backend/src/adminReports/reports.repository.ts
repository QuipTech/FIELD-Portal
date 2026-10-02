import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import {
  AiUsageReportRow,
  CaseReportRow,
  FleetUptimeRow,
} from './types/reportRows';

// scope.tenantId is each function's p_tenant_id (migration 0064): one
// organisation, or null (every organisation) for the Owner.

export const listFleetUptime = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  since: Date,
): Promise<FleetUptimeRow[]> => {
  const result = await databaseService.query<FleetUptimeRow>(
    `SELECT * FROM admin_report_fleet_uptime($1, $2)`,
    [scope.tenantId, since],
  );
  return result.rows;
};

export const listCases = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  resolvedSince: Date,
): Promise<CaseReportRow[]> => {
  const result = await databaseService.query<CaseReportRow>(
    `SELECT * FROM admin_report_cases($1, $2)`,
    [scope.tenantId, resolvedSince],
  );
  return result.rows;
};

export const listAiUsage = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  days: number,
): Promise<AiUsageReportRow[]> => {
  const result = await databaseService.query<AiUsageReportRow>(
    `SELECT * FROM admin_report_ai_usage($1, $2)`,
    [scope.tenantId, days],
  );
  return result.rows;
};
