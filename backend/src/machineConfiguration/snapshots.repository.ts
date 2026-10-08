import { PoolClient } from 'pg';
import { SnapshotItemRow, SnapshotRow } from './types/machineConfigurationRows';

const SNAPSHOT_COLUMNS = `
  cs.id, cs.taken_at, cs.trigger, cs.is_known_good,
  u.id AS taken_by_id, u.first_name AS taken_by_first_name,
  u.last_name AS taken_by_last_name, u.avatar_url AS taken_by_avatar_url`;

// Newest first.
export const listSnapshots = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<SnapshotRow[]> => {
  const result = await client.query<SnapshotRow>(
    `SELECT ${SNAPSHOT_COLUMNS}
     FROM configuration_snapshots cs
     LEFT JOIN users u ON u.id = cs.taken_by
     WHERE cs.machine_id = $1 AND cs.tenant_id = $2
     ORDER BY cs.taken_at DESC`,
    [machineId, tenantId],
  );
  return result.rows;
};

export const findSnapshot = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; snapshotId: string },
): Promise<SnapshotRow | null> => {
  const result = await client.query<SnapshotRow>(
    `SELECT ${SNAPSHOT_COLUMNS}
     FROM configuration_snapshots cs
     LEFT JOIN users u ON u.id = cs.taken_by
     WHERE cs.id = $1 AND cs.machine_id = $2 AND cs.tenant_id = $3`,
    [params.snapshotId, params.machineId, params.tenantId],
  );
  return result.rows[0] ?? null;
};

export const listSnapshotItems = async (
  client: PoolClient,
  tenantId: string,
  snapshotId: string,
): Promise<SnapshotItemRow[]> => {
  const result = await client.query<SnapshotItemRow>(
    `SELECT system_name, component_name, serial_number, firmware_version, software_version
     FROM configuration_snapshot_items
     WHERE snapshot_id = $1 AND tenant_id = $2
     ORDER BY system_name, component_name`,
    [snapshotId, tenantId],
  );
  return result.rows;
};

// Records the machine's current installed configuration; the caller must
// have set the tenant context (withTenant) for capture_configuration_snapshot.
export const captureSnapshot = async (
  client: PoolClient,
  params: { machineId: string; takenBy: string | null; trigger: string },
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    'SELECT capture_configuration_snapshot($1, $2, $3) AS id',
    [params.machineId, params.takenBy, params.trigger],
  );
  return result.rows[0].id;
};

export const setSnapshotKnownGood = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; snapshotId: string; isKnownGood: boolean },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE configuration_snapshots SET is_known_good = $4, updated_at = now()
     WHERE id = $1 AND machine_id = $2 AND tenant_id = $3`,
    [params.snapshotId, params.machineId, params.tenantId, params.isKnownGood],
  );
  return (result.rowCount ?? 0) > 0;
};
