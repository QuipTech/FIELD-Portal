import { PoolClient } from 'pg';
import {
  MachineScope,
  linkedMachineInScopeSql,
  machineInScopeSql,
  toScopeParam,
} from '../machineGroups/access/machineScope';
import { MACHINE_LABEL_SQL } from '../machineFleet/machineFleet.repository';
import { CasePriority } from './types/dashboardResponse';
import {
  CaseCountsRow,
  DownMachineRow,
  EntryCountsRow,
} from './types/dashboardRows';

const DOWN_MACHINES_SHOWN = 3;

// Every query filters on tenant_id explicitly as well as relying on RLS,
// since the backend's database role may bypass RLS. Machines, and cases and
// entries about machines, are limited to the caller's machine scope.

export const countOpenCases = async (
  client: PoolClient,
  tenantId: string,
  slaHours: Record<CasePriority, number>,
  scope: MachineScope,
): Promise<CaseCountsRow> => {
  const result = await client.query<CaseCountsRow>(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE NOT sla_paused AND COALESCE(sla_due_at,
              created_at + interval '1 hour' *
                CASE priority WHEN 'P1' THEN $2::numeric WHEN 'P2' THEN $3::numeric
                              ELSE $4::numeric END) < now()
            ) AS breaching,
            count(*) FILTER (WHERE priority = 'P1') AS p1,
            count(*) FILTER (WHERE priority = 'P2') AS p2,
            count(*) FILTER (WHERE priority = 'P3') AS p3
     FROM support_cases
     WHERE tenant_id = $1 AND deleted_at IS NULL
       AND status IN ('new', 'open', 'waiting_on_customer')
       AND ${linkedMachineInScopeSql('machine_id', 'tenant_id', '$5')}`,
    [tenantId, slaHours.P1, slaHours.P2, slaHours.P3, toScopeParam(scope)],
  );
  return result.rows[0];
};

export const listDownMachines = async (
  client: PoolClient,
  tenantId: string,
  scope: MachineScope,
): Promise<DownMachineRow[]> => {
  const result = await client.query<DownMachineRow>(
    `SELECT m.id, ${MACHINE_LABEL_SQL} AS label, count(*) OVER () AS total
     FROM machines m
     WHERE m.tenant_id = $1 AND m.deleted_at IS NULL AND m.status = 'down'
       AND ${machineInScopeSql('m', '$2')}
     ORDER BY m.updated_at DESC
     LIMIT ${DOWN_MACHINES_SHOWN}`,
    [tenantId, toScopeParam(scope)],
  );
  return result.rows;
};

// "This week" starts Monday 00:00 in the database's time zone (UTC).
export const countEntriesThisWeek = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; scope: MachineScope },
): Promise<EntryCountsRow> => {
  const result = await client.query<EntryCountsRow>(
    `SELECT count(*) AS total, count(*) FILTER (WHERE created_by = $2) AS mine
     FROM technical_history_entries
     WHERE tenant_id = $1 AND deleted_at IS NULL
       AND created_at >= date_trunc('week', now())
       AND ${linkedMachineInScopeSql('machine_id', 'tenant_id', '$3')}`,
    [params.tenantId, params.userId, toScopeParam(params.scope)],
  );
  return result.rows[0];
};
