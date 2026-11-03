import { PoolClient } from 'pg';

export interface MachineOptionRow {
  id: string;
  label: string;
  model_name: string | null;
  // Set for a machine another organisation shares with the caller.
  shared_by_organisation_name: string | null;
}

// Machines the caller may raise a case about, for the New case form: their
// organisation's machines in their scope, and shared ones they may
// contribute to (accessible_machines(), migration 0116).
export const listMachineOptions = async (
  client: PoolClient,
): Promise<MachineOptionRow[]> => {
  const result = await client.query<MachineOptionRow>(
    `SELECT m.id, COALESCE(m.asset_number, m.fleet_number, m.serial_number) AS label,
            mm.name AS model_name,
            CASE WHEN am.is_shared THEN t.name END AS shared_by_organisation_name
     FROM accessible_machines() am
     JOIN machines m ON m.id = am.machine_id AND m.deleted_at IS NULL
     JOIN tenants t ON t.id = m.tenant_id
     LEFT JOIN machine_models mm ON mm.id = m.model_id
     WHERE am.access_level <> 'view'
     ORDER BY label`,
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
