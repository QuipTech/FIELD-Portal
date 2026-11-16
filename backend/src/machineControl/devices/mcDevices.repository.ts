import { PoolClient } from 'pg';
import {
  ACCESSIBLE_MACHINES,
  visibleMachineSql,
} from '../../machineSharing/access/machineScope';
import { MACHINE_LABEL_SQL } from '../../machineFleet/machineFleet.repository';

export interface McDeviceRow {
  id: string;
  machine_id: string;
  machine_label: string;
  manufacturer_name: string;
  model_name: string;
  site: string | null;
  serial_number: string | null;
  platform: string | null;
  app_version: string | null;
  paired_at: Date;
  online_since: Date | null;
  last_seen_at: Date | null;
}

// Connected tablets on machines the caller can see, online ones first.
export const listConnectedDevices = async (
  client: PoolClient,
  tenantId: string,
): Promise<McDeviceRow[]> => {
  const result = await client.query<McDeviceRow>(
    `SELECT d.id, d.machine_id, ${MACHINE_LABEL_SQL} AS machine_label,
            mf.name AS manufacturer_name, mm.name AS model_name, m.site,
            d.serial_number, d.platform, d.app_version, d.paired_at,
            d.online_since, d.last_seen_at
     FROM mc_devices d
     JOIN machines m ON m.id = d.machine_id AND m.deleted_at IS NULL
     JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     JOIN machine_models mm ON mm.id = m.model_id
     WHERE d.disabled_at IS NULL AND d.deleted_at IS NULL
       AND ${visibleMachineSql('m', '$1', ACCESSIBLE_MACHINES)}
     ORDER BY d.online_since IS NULL, ${MACHINE_LABEL_SQL}`,
    [tenantId],
  );
  return result.rows;
};

// Active machines the caller may connect a tablet to (own, or 'contribute').
export const countConnectableMachines = async (
  client: PoolClient,
  tenantId: string,
): Promise<number> => {
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM machines m
     JOIN accessible_machines() am ON am.machine_id = m.id
     WHERE m.deleted_at IS NULL AND m.lifecycle_state = 'active'
       AND am.access_level <> 'view' AND (am.tenant_id = $1 OR am.is_shared)`,
    [tenantId],
  );
  return result.rows[0].count;
};
