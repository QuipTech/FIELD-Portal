import { DatabaseService } from '../database/database.service';
import { AdminScope } from '../auth/adminScope/adminScope';
import {
  IngestionQueueRow,
  OverviewSummaryRow,
} from './types/adminOverviewRows';

// scope.tenantId is each function's p_tenant_id (migration 0058): the
// scoped organisation, or null (every organisation) for the Owner.

export const getOverviewSummary = async (
  databaseService: DatabaseService,
  scope: AdminScope,
): Promise<OverviewSummaryRow> => {
  const result = await databaseService.query<OverviewSummaryRow>(
    `SELECT * FROM admin_overview_summary($1)`,
    [scope.tenantId],
  );
  return result.rows[0];
};

export const listIngestionQueue = async (
  databaseService: DatabaseService,
  scope: AdminScope,
  limit: number,
): Promise<IngestionQueueRow[]> => {
  const result = await databaseService.query<IngestionQueueRow>(
    `SELECT * FROM admin_overview_ingestion_queue($1, $2)`,
    [scope.tenantId, limit],
  );
  return result.rows;
};

// tenants has no RLS.
export const findOrganisationName = async (
  databaseService: DatabaseService,
  tenantId: string,
): Promise<string | null> => {
  const result = await databaseService.query<{ name: string }>(
    `SELECT name FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return result.rows[0]?.name ?? null;
};
