import { PoolClient } from 'pg';
import { MACHINE_LABEL_SQL } from '../machineFleet/machineFleet.repository';
import { MovedMachineRow } from './types/machineGroupTypes';

// Moving machines between groups, and what deleting a group takes with
// it. Every query filters on tenant_id itself as well as relying on RLS.

// The live machines among `machineIds`, with the group each is in now.
export const findMachinesForMove = async (
  client: PoolClient,
  tenantId: string,
  machineIds: string[],
): Promise<MovedMachineRow[]> => {
  const result = await client.query<MovedMachineRow>(
    `SELECT m.id, ${MACHINE_LABEL_SQL} AS label, m.group_id, g.name AS group_name
     FROM machines m
     LEFT JOIN machine_groups g ON g.id = m.group_id
     WHERE m.tenant_id = $1 AND m.id = ANY($2::uuid[]) AND m.deleted_at IS NULL
     ORDER BY m.id`,
    [tenantId, machineIds],
  );
  return result.rows;
};

export const setMachinesGroup = async (
  client: PoolClient,
  params: { tenantId: string; machineIds: string[]; groupId: string | null },
): Promise<void> => {
  await client.query(
    `UPDATE machines SET group_id = $3, updated_at = now()
     WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
    [params.tenantId, params.machineIds, params.groupId],
  );
};

// The ids of the machines that were in the group.
export const ungroupMachines = async (
  client: PoolClient,
  tenantId: string,
  groupId: string,
): Promise<string[]> => {
  const result = await client.query<{ id: string }>(
    `UPDATE machines SET group_id = NULL, updated_at = now()
     WHERE group_id = $1 AND tenant_id = $2
     RETURNING id`,
    [groupId, tenantId],
  );
  return result.rows.map((row) => row.id);
};

// The ids of the people who had the group.
export const deleteGroupAccess = async (
  client: PoolClient,
  tenantId: string,
  groupId: string,
): Promise<string[]> => {
  const result = await client.query<{ user_id: string }>(
    `DELETE FROM user_machine_group_access
     WHERE group_id = $1 AND tenant_id = $2
     RETURNING user_id`,
    [groupId, tenantId],
  );
  return result.rows.map((row) => row.user_id);
};
