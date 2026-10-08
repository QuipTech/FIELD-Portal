import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminCaseTab } from './dto/listAdminSupportCasesQueryDto';
import { CasePriority, CaseStatus } from './types/supportCaseResponse';
import {
  AdminCaseListRow,
  AdminCaseStatsRow,
  SupportStaffRow,
} from './types/supportCaseRows';

// The support queue's cross-organisation reads (SECURITY DEFINER, 0070).
// onlyAssigneeId narrows everything to one Support Agent's cases; it is
// null only for the admin (see SupportStaffGuard).

export interface AdminCaseListParams {
  viewerId: string;
  onlyAssigneeId: string | null;
  tab: AdminCaseTab;
  tenantId: string | null;
  priority: CasePriority | null;
  status: CaseStatus | null;
  search: string | null;
  limit: number;
  offset: number;
}

export const listAdminCases = async (
  databaseService: DatabaseService,
  params: AdminCaseListParams,
): Promise<AdminCaseListRow[]> => {
  const result = await databaseService.query<AdminCaseListRow>(
    `SELECT * FROM admin_list_support_cases($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      params.viewerId,
      params.onlyAssigneeId,
      params.tab,
      params.tenantId,
      params.priority,
      params.status,
      params.search,
      params.limit,
      params.offset,
    ],
  );
  return result.rows;
};

export const findAdminCaseStats = async (
  databaseService: DatabaseService,
  params: { viewerId: string; onlyAssigneeId: string | null },
): Promise<AdminCaseStatsRow> => {
  const result = await databaseService.query<AdminCaseStatsRow>(
    `SELECT * FROM admin_support_case_stats($1, $2)`,
    [params.viewerId, params.onlyAssigneeId],
  );
  return result.rows[0];
};

export const listSupportStaff = async (
  databaseService: DatabaseService,
): Promise<SupportStaffRow[]> => {
  const result = await databaseService.query<SupportStaffRow>(
    `SELECT * FROM admin_list_support_staff()`,
  );
  return result.rows;
};

export const countUnreadCasesForStaff = async (
  databaseService: DatabaseService,
  userId: string,
): Promise<number> => {
  const result = await databaseService.query<{ count: string }>(
    `SELECT support_staff_unread_case_count($1) AS count`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
};

export const findCaseTenantId = async (
  databaseService: DatabaseService,
  caseNumber: number,
): Promise<string | null> => {
  const result = await databaseService.query<{ tenant_id: string | null }>(
    `SELECT support_case_tenant_id($1) AS tenant_id`,
    [caseNumber],
  );
  return result.rows[0]?.tenant_id ?? null;
};

// Runs under the case's own tenant: the organisation and its plan.
export const findCaseCompany = async (
  client: PoolClient,
  tenantId: string,
): Promise<{ id: string; name: string; plan: string | null }> => {
  const result = await client.query<{
    id: string;
    name: string;
    plan: string | null;
  }>(
    `SELECT t.id, t.name, s.tier AS plan FROM tenants t
     LEFT JOIN app.subscriptions s ON s.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId],
  );
  return result.rows[0];
};
