import { DatabaseService } from '../../database/database.service';
import {
  QueriesPerDayRow,
  UsageByOrganisationRow,
  UsageSummaryRow,
} from '../types/adminAiRows';

export const getUsageSummary = async (
  databaseService: DatabaseService,
  days: number,
): Promise<UsageSummaryRow> => {
  const result = await databaseService.query<UsageSummaryRow>(
    `SELECT * FROM admin_ai_usage_summary($1)`,
    [days],
  );
  return result.rows[0];
};

export const listQueriesPerDay = async (
  databaseService: DatabaseService,
  days: number,
): Promise<QueriesPerDayRow[]> => {
  const result = await databaseService.query<QueriesPerDayRow>(
    `SELECT * FROM admin_ai_queries_per_day($1)`,
    [days],
  );
  return result.rows;
};

export const listUsageByOrganisation = async (
  databaseService: DatabaseService,
  params: { days: number; limit: number },
): Promise<UsageByOrganisationRow[]> => {
  const result = await databaseService.query<UsageByOrganisationRow>(
    `SELECT * FROM admin_ai_usage_by_organisation($1, $2)`,
    [params.days, params.limit],
  );
  return result.rows;
};
