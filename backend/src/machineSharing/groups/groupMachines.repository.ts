import { PoolClient } from 'pg';
import { escapeLikePattern } from '../../common/utils/escapeLikePattern';

// A group's machines, from any organisation. Reading other organisations'
// machines goes through SECURITY DEFINER functions that check the caller
// is the platform administrator (migration 0119); RLS still applies to
// every write.

export interface PlatformMachineRow {
  id: string;
  label: string;
  serial_number: string;
  model_name: string;
  manufacturer_name: string;
  status: string;
  lifecycle_state: string;
  tenant_id: string;
  organisation_name: string;
}

export interface GroupMachineRow extends PlatformMachineRow {
  added_at: Date;
}

export const listGroupMachines = async (
  client: PoolClient,
  groupId: string,
): Promise<GroupMachineRow[]> => {
  const result = await client.query<GroupMachineRow>(
    'SELECT * FROM admin_list_group_machines($1)',
    [groupId],
  );
  return result.rows;
};

// Plant ID, fleet number, serial, VIN or organisation name.
export const searchPlatformMachines = async (
  client: PoolClient,
  params: { search?: string; limit: number },
): Promise<(PlatformMachineRow & { registration_number: string | null })[]> => {
  const result = await client.query(
    'SELECT * FROM admin_search_machines($1, $2)',
    [
      params.search ? `%${escapeLikePattern(params.search)}%` : null,
      params.limit,
    ],
  );
  return result.rows;
};

// The live machines among machineIds, each with its owning organisation.
export const findPlatformMachines = async (
  client: PoolClient,
  machineIds: string[],
): Promise<{ id: string; tenant_id: string; label: string }[]> => {
  const result = await client.query<{
    id: string;
    tenant_id: string;
    label: string;
  }>('SELECT * FROM admin_find_machines($1::uuid[])', [machineIds]);
  return result.rows;
};

// The ids actually added (ones already in the group are skipped).
export const insertGroupMachines = async (
  client: PoolClient,
  params: { groupId: string; machineIds: string[]; addedBy: string },
): Promise<string[]> => {
  const result = await client.query<{ machine_id: string }>(
    `INSERT INTO machine_group_machines (group_id, machine_id, added_by)
     SELECT $1, unnest($2::uuid[]), $3
     ON CONFLICT (group_id, machine_id) DO NOTHING
     RETURNING machine_id`,
    [params.groupId, params.machineIds, params.addedBy],
  );
  return result.rows.map((row) => row.machine_id);
};

export const deleteGroupMachine = async (
  client: PoolClient,
  params: { groupId: string; machineId: string },
): Promise<boolean> => {
  const result = await client.query(
    `DELETE FROM machine_group_machines WHERE group_id = $1 AND machine_id = $2`,
    [params.groupId, params.machineId],
  );
  return (result.rowCount ?? 0) > 0;
};
