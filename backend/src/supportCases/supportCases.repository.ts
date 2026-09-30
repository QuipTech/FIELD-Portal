import { PoolClient } from 'pg';
import { escapeLikePattern } from '../common/utils/escapeLikePattern';
import { CaseStatusFilter } from './dto/listSupportCasesQueryDto';
import {
  CaseCategory,
  CasePriority,
  CaseStatus,
} from './types/supportCaseResponse';
import { StatusCountRow, SupportCaseRow } from './types/supportCaseRows';

// Every query filters on tenant_id itself: the backend's database role may
// bypass RLS.
const CASE_SELECT = `
  SELECT c.id, c.case_number, c.subject, c.category, c.status, c.priority,
         c.created_at, c.updated_at, c.resolved_at,
         m.id AS machine_id,
         COALESCE(m.asset_number, m.fleet_number, m.serial_number) AS machine_label,
         mm.name AS machine_model_name,
         a.id AS assignee_id, a.first_name AS assignee_first_name, a.last_name AS assignee_last_name,
         r.id AS reporter_id, r.first_name AS reporter_first_name, r.last_name AS reporter_last_name
  FROM support_cases c
  LEFT JOIN machines m ON m.id = c.machine_id
  LEFT JOIN machine_models mm ON mm.id = m.model_id
  LEFT JOIN users a ON a.id = c.assigned_to
  LEFT JOIN users r ON r.id = c.created_by`;

export interface CaseListFilters {
  status: CaseStatusFilter;
  priority?: CasePriority;
  assignee?: string;
  search?: string;
}

const STATUS_CONDITIONS: Record<CaseStatusFilter, string | null> = {
  active: `c.status IN ('open', 'in_progress')`,
  open: `c.status = 'open'`,
  in_progress: `c.status = 'in_progress'`,
  resolved: `c.status = 'resolved'`,
  all: null,
};

export const listCases = async (
  client: PoolClient,
  tenantId: string,
  filters: CaseListFilters,
): Promise<SupportCaseRow[]> => {
  const params: unknown[] = [tenantId];
  const conditions = ['c.tenant_id = $1', 'c.deleted_at IS NULL'];
  const statusCondition = STATUS_CONDITIONS[filters.status];
  if (statusCondition) conditions.push(statusCondition);
  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`c.priority = $${params.length}`);
  }
  if (filters.assignee === 'unassigned') {
    conditions.push('c.assigned_to IS NULL');
  } else if (filters.assignee) {
    params.push(filters.assignee);
    conditions.push(`c.assigned_to::text = $${params.length}`);
  }
  if (filters.search) {
    const caseNumber = filters.search.replace(/^#/, '');
    params.push(`%${escapeLikePattern(filters.search)}%`, caseNumber);
    conditions.push(
      `(c.subject ILIKE $${params.length - 1} OR c.case_number::text = $${params.length})`,
    );
  }
  const result = await client.query<SupportCaseRow>(
    `${CASE_SELECT} WHERE ${conditions.join(' AND ')}
     ORDER BY c.updated_at DESC LIMIT 200`,
    params,
  );
  return result.rows;
};

export const countCasesByStatus = async (
  client: PoolClient,
  tenantId: string,
): Promise<StatusCountRow[]> => {
  const result = await client.query<StatusCountRow>(
    `SELECT status, count(*) FROM support_cases
     WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status`,
    [tenantId],
  );
  return result.rows;
};

export const findCaseByNumber = async (
  client: PoolClient,
  tenantId: string,
  caseNumber: number,
): Promise<SupportCaseRow | null> => {
  const result = await client.query<SupportCaseRow>(
    `${CASE_SELECT}
     WHERE c.tenant_id = $1 AND c.case_number = $2 AND c.deleted_at IS NULL`,
    [tenantId, caseNumber],
  );
  return result.rows[0] ?? null;
};

export const insertCase = async (
  client: PoolClient,
  params: {
    tenantId: string;
    reporterId: string;
    subject: string;
    category: CaseCategory;
    priority: CasePriority;
    machineId: string | null;
  },
): Promise<{ id: string; case_number: string }> => {
  const result = await client.query<{ id: string; case_number: string }>(
    `INSERT INTO support_cases (tenant_id, created_by, subject, category, priority, machine_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, case_number`,
    [
      params.tenantId,
      params.reporterId,
      params.subject,
      params.category,
      params.priority,
      params.machineId,
    ],
  );
  return result.rows[0];
};

export interface CasePatch {
  status?: CaseStatus;
  priority?: CasePriority;
  assigneeId?: string | null;
}

// Only the fields present change; resolved_at follows the status. The
// row-version trigger bumps updated_at either way.
export const updateCase = async (
  client: PoolClient,
  params: { tenantId: string; caseId: string; patch: CasePatch },
): Promise<void> => {
  const { patch } = params;
  const values: unknown[] = [params.tenantId, params.caseId];
  const assignments: string[] = [];
  if (patch.status) {
    values.push(patch.status);
    const statusParam = `$${values.length}::varchar`;
    assignments.push(
      `status = ${statusParam}`,
      `resolved_at = CASE WHEN ${statusParam} = 'resolved' THEN COALESCE(resolved_at, now()) ELSE NULL END`,
    );
  }
  if (patch.priority) {
    values.push(patch.priority);
    assignments.push(`priority = $${values.length}`);
  }
  if (patch.assigneeId !== undefined) {
    values.push(patch.assigneeId);
    assignments.push(`assigned_to = $${values.length}::uuid`);
  }
  if (!assignments.length) assignments.push('updated_at = now()');
  await client.query(
    `UPDATE support_cases SET ${assignments.join(', ')}
     WHERE tenant_id = $1 AND id = $2`,
    values,
  );
};

// A new message moves the case to the top of the list.
export const touchCase = async (
  client: PoolClient,
  tenantId: string,
  caseId: string,
): Promise<void> => {
  await client.query(
    `UPDATE support_cases SET updated_at = now() WHERE tenant_id = $1 AND id = $2`,
    [tenantId, caseId],
  );
};
