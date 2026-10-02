import { DatabaseService } from '../../database/database.service';
import { AdminScope } from '../../auth/adminScope/adminScope';
import {
  PlatformUsageRow,
  QueriesPerDayRow,
  UsageByOrganisationRow,
  UsageSummaryRow,
} from '../types/adminAiRows';

// scope.tenantId is each function's p_tenant_id (migration 0056): the
// scoped organisation, or null (every organisation) for the Owner.

export const getUsageSummary = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  days: number,
): Promise<UsageSummaryRow> => {
  const result = await databaseService.query<UsageSummaryRow>(
    `SELECT * FROM admin_ai_usage_summary($1, $2)`,
    [scope.tenantId, days],
  );
  return result.rows[0];
};

export const listQueriesPerDay = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  days: number,
): Promise<QueriesPerDayRow[]> => {
  const result = await databaseService.query<QueriesPerDayRow>(
    `SELECT * FROM admin_ai_queries_per_day($1, $2)`,
    [scope.tenantId, days],
  );
  return result.rows;
};

export const listUsageByOrganisation = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  params: { days: number; limit: number },
): Promise<UsageByOrganisationRow[]> => {
  const result = await databaseService.query<UsageByOrganisationRow>(
    `SELECT * FROM admin_ai_usage_by_organisation($1, $2, $3)`,
    [scope.tenantId, params.days, params.limit],
  );
  return result.rows;
};

// Prompt tests, indexing and search (migration 0063); prompt tests and
// shared documents (no tenant) only appear for the Owner.
export const listPlatformUsage = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  days: number,
): Promise<PlatformUsageRow[]> => {
  const result = await databaseService.query<PlatformUsageRow>(
    `SELECT * FROM admin_ai_platform_usage($1, $2)`,
    [scope.tenantId, days],
  );
  return result.rows;
};
