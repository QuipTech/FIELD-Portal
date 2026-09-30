import { PoolClient } from 'pg';

export interface AssigneeRow {
  id: string;
  first_name: string;
  last_name: string;
}

export interface MachineOptionRow {
  id: string;
  label: string;
  model_name: string | null;
}

// Active users in the organisation whose roles grant support.manage.
export const listAssignableUsers = async (
  client: PoolClient,
  tenantId: string,
): Promise<AssigneeRow[]> => {
  const result = await client.query<AssigneeRow>(
    `SELECT DISTINCT u.id, u.first_name, u.last_name FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id AND p.code = 'support.manage'
     WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.status = 'active'
     ORDER BY u.first_name, u.last_name`,
    [tenantId],
  );
  return result.rows;
};

export const listMachineOptions = async (
  client: PoolClient,
  tenantId: string,
): Promise<MachineOptionRow[]> => {
  const result = await client.query<MachineOptionRow>(
    `SELECT m.id, COALESCE(m.asset_number, m.fleet_number, m.serial_number) AS label,
            mm.name AS model_name
     FROM machines m
     LEFT JOIN machine_models mm ON mm.id = m.model_id
     WHERE m.tenant_id = $1 AND m.deleted_at IS NULL
     ORDER BY label`,
    [tenantId],
  );
  return result.rows;
};

// For the "… is typing" line in a case chat.
export const findUserDisplayName = async (
  client: PoolClient,
  tenantId: string,
  userId: string,
): Promise<string | null> => {
  const result = await client.query<{ name: string }>(
    `SELECT trim(first_name || ' ' || last_name) AS name FROM users
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [userId, tenantId],
  );
  return result.rows[0]?.name ?? null;
};

export const machineBelongsToTenant = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<boolean> => {
  const result = await client.query(
    `SELECT 1 FROM machines WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [machineId, tenantId],
  );
  return (result.rowCount ?? 0) > 0;
};
