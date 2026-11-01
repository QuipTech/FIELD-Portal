import { PoolClient } from 'pg';
import { toLimitOffset } from '../common/dto/paginationQueryDto';
import {
  MachineScope,
  linkedMachineInScopeSql,
  toScopeParam,
} from '../machineGroups/access/machineScope';
import { buildCaseFilter, CaseListFilters } from './caseFilter';
import {
  CaseCategory,
  CasePriority,
  CaseStatus,
} from './types/supportCaseResponse';
import { StatusCountRow, SupportCaseRow } from './types/supportCaseRows';

// Every query filters on tenant_id itself: the backend's database role may
// bypass RLS. For customers, a case about a machine outside their machine
// scope (machineGroups/access) doesn't exist; staff pass ALL_MACHINES. The assignee is QuipTech support staff from another
// organisation, which RLS hides, so people come from support_case_person
// (0070) rather than a join on users.
const CASE_SELECT = `
  SELECT c.id, c.tenant_id, c.case_number, c.subject, c.description, c.category,
         c.custom_category,
         c.status, c.priority, c.created_at, c.updated_at, c.resolved_at, c.closed_at,
         c.sla_due_at, c.sla_paused_at, c.first_response_at,
         m.id AS machine_id,
         COALESCE(m.asset_number, m.fleet_number, m.serial_number) AS machine_label,
         mm.name AS machine_model_name,
         a.id AS assignee_id, a.first_name AS assignee_first_name, a.last_name AS assignee_last_name,
         a.email AS assignee_email, a.avatar_url AS assignee_avatar_url,
         r.id AS reporter_id, r.first_name AS reporter_first_name, r.last_name AS reporter_last_name,
         r.email AS reporter_email, r.avatar_url AS reporter_avatar_url
  FROM support_cases c
  LEFT JOIN machines m ON m.id = c.machine_id
  LEFT JOIN machine_models mm ON mm.id = m.model_id
  LEFT JOIN LATERAL support_case_person(c.assigned_to) a ON true
  LEFT JOIN LATERAL support_case_person(c.created_by) r ON true`;

export const listCases = async (
  client: PoolClient,
  tenantId: string,
  filters: CaseListFilters,
  scope: MachineScope,
): Promise<SupportCaseRow[]> => {
  const { where, params } = buildCaseFilter(tenantId, scope, filters);
  const { limit, offset } = toLimitOffset(filters);
  const result = await client.query<SupportCaseRow>(
    `${CASE_SELECT} WHERE ${where}
     ORDER BY c.updated_at DESC, c.id
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return result.rows;
};

export const countCases = async (
  client: PoolClient,
  tenantId: string,
  filters: CaseListFilters,
  scope: MachineScope,
): Promise<number> => {
  const { where, params } = buildCaseFilter(tenantId, scope, filters);
  const result = await client.query<{ count: string }>(
    `SELECT count(*) FROM support_cases c WHERE ${where}`,
    params,
  );
  return Number(result.rows[0].count);
};

export const countCasesByStatus = async (
  client: PoolClient,
  tenantId: string,
  scope: MachineScope,
): Promise<StatusCountRow[]> => {
  const result = await client.query<StatusCountRow>(
    `SELECT status, count(*) FROM support_cases
     WHERE tenant_id = $1 AND deleted_at IS NULL
       AND ${linkedMachineInScopeSql('machine_id', 'tenant_id', '$2')}
     GROUP BY status`,
    [tenantId, toScopeParam(scope)],
  );
  return result.rows;
};

export const findCaseByNumber = async (
  client: PoolClient,
  tenantId: string,
  caseNumber: number,
  scope: MachineScope,
): Promise<SupportCaseRow | null> => {
  const result = await client.query<SupportCaseRow>(
    `${CASE_SELECT}
     WHERE c.tenant_id = $1 AND c.case_number = $2 AND c.deleted_at IS NULL
       AND ${linkedMachineInScopeSql('c.machine_id', 'c.tenant_id', '$3')}`,
    [tenantId, caseNumber, toScopeParam(scope)],
  );
  return result.rows[0] ?? null;
};

export const insertCase = async (
  client: PoolClient,
  params: {
    tenantId: string;
    reporterId: string;
    subject: string;
    description: string;
    category: CaseCategory;
    customCategory: string | null;
    priority: CasePriority;
    machineId: string | null;
    slaHours: number;
  },
): Promise<{ id: string; case_number: string }> => {
  const result = await client.query<{ id: string; case_number: string }>(
    `INSERT INTO support_cases
       (tenant_id, created_by, subject, description, category, custom_category, priority, machine_id,
        status, sla_due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', now() + make_interval(hours => $9::int))
     RETURNING id, case_number`,
    [
      params.tenantId,
      params.reporterId,
      params.subject,
      params.description,
      params.category,
      params.customCategory,
      params.priority,
      params.machineId,
      params.slaHours,
    ],
  );
  return result.rows[0];
};

export interface CasePatch {
  status?: CaseStatus;
  priority?: CasePriority;
  assigneeId?: string | null;
  // A priority change moves the SLA due time by the difference in targets.
  slaShiftHours?: number;
}

// Only the fields present change. resolved_at, closed_at and the SLA
// pause follow the status in a trigger (0069); the row-version trigger
// bumps updated_at either way.
export const updateCase = async (
  client: PoolClient,
  params: { tenantId: string; caseId: string; patch: CasePatch },
): Promise<void> => {
  const { patch } = params;
  const values: unknown[] = [params.tenantId, params.caseId];
  const assignments: string[] = [];
  const assign = (column: string, value: unknown, cast = '') => {
    values.push(value);
    assignments.push(`${column} = $${values.length}${cast}`);
  };
  if (patch.status) assign('status', patch.status);
  if (patch.priority) assign('priority', patch.priority);
  if (patch.assigneeId !== undefined) {
    assign('assigned_to', patch.assigneeId, '::uuid');
  }
  if (patch.slaShiftHours) {
    values.push(patch.slaShiftHours);
    assignments.push(
      `sla_due_at = sla_due_at + make_interval(hours => $${values.length}::int)`,
    );
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
