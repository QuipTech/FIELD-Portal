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

// Sets each installed component's serial, firmware and software to the
// snapshot's values, matching by system and component name. Components
// aren't added or removed. Returns how many changed.
export const restoreSnapshotValues = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; snapshotId: string },
): Promise<number> => {
  const result = await client.query(
    `UPDATE installed_components c
     SET serial_number = i.serial_number, firmware_version = i.firmware_version,
         software_version = i.software_version, updated_at = now()
     FROM installed_systems s, configuration_snapshot_items i
     WHERE c.installed_system_id = s.id AND s.machine_id = $1 AND s.tenant_id = $2
       AND s.deleted_at IS NULL AND c.deleted_at IS NULL
       AND i.snapshot_id = $3 AND i.tenant_id = $2
       AND i.system_name = s.name AND i.component_name = c.name
       AND (c.serial_number, c.firmware_version, c.software_version)
           IS DISTINCT FROM (i.serial_number, i.firmware_version, i.software_version)`,
    [params.machineId, params.tenantId, params.snapshotId],
  );
  return result.rowCount ?? 0;
};

export interface UnmatchedComponentRow {
  system_name: string;
  component_name: string;
  // 'missing': in the snapshot, not installed now. 'extra': installed now,
  // not in the snapshot. Restoring leaves both as they are.
  side: 'missing' | 'extra';
}

export const listUnmatchedComponents = async (
  client: PoolClient,
  params: { tenantId: string; machineId: string; snapshotId: string },
): Promise<UnmatchedComponentRow[]> => {
  const result = await client.query<UnmatchedComponentRow>(
    `WITH installed AS (
       SELECT s.name AS system_name, c.name AS component_name
       FROM installed_systems s JOIN installed_components c ON c.installed_system_id = s.id
       WHERE s.machine_id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL AND c.deleted_at IS NULL
     ),
     recorded AS (
       SELECT system_name, component_name FROM configuration_snapshot_items
       WHERE snapshot_id = $3 AND tenant_id = $2
     )
     SELECT system_name, component_name, 'missing' AS side FROM recorded
     EXCEPT SELECT system_name, component_name, 'missing' FROM installed
     UNION ALL
     (SELECT system_name, component_name, 'extra' FROM installed
      EXCEPT SELECT system_name, component_name, 'extra' FROM recorded)
     ORDER BY side, system_name, component_name`,
    [params.machineId, params.tenantId, params.snapshotId],
  );
  return result.rows;
};
