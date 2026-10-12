import { PoolClient } from 'pg';

export interface MachineOptionRow {
  id: string;
  label: string;
  model_name: string | null;
}

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
