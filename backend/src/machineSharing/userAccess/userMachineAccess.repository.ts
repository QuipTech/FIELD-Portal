import { PoolClient } from 'pg';
import { MachineAccessMode } from '../access/machineScope';
import { AccessibleGroup, MachineAccess } from '../types/machineGroupTypes';

interface UserMachineAccessRow {
  user_id: string;
  machine_access_mode: MachineAccessMode;
  is_admin: boolean;
  groups: AccessibleGroup[];
}

// Admins always see their organisation's machines, whatever is stored.
const toMachineAccess = (row: UserMachineAccessRow): MachineAccess => ({
  machineAccessMode: row.machine_access_mode,
  effectiveMode: row.is_admin ? 'all' : row.machine_access_mode,
  groups: row.groups,
});

// Keyed by user id (users_machine_access(), migration 0119): the platform
// administrator reads anyone; others only their own organisation's people.
// People not found are left out.
export const findUsersMachineAccess = async (
  client: PoolClient,
  userIds: string[],
): Promise<Map<string, MachineAccess>> => {
  if (!userIds.length) return new Map();
  const result = await client.query<UserMachineAccessRow>(
    'SELECT * FROM users_machine_access($1::uuid[])',
    [userIds],
  );
  return new Map(result.rows.map((row) => [row.user_id, toMachineAccess(row)]));
};

// The person's organisation must be in app.tenant_id (users RLS); false
// when they aren't found there.
export const updateMachineAccessMode = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; mode: MachineAccessMode },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE users SET machine_access_mode = $3, updated_at = now()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [params.userId, params.tenantId, params.mode],
  );
  return (result.rowCount ?? 0) > 0;
};
