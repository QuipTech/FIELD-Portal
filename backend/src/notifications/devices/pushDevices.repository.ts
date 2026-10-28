import { PoolClient } from 'pg';

export interface PushDeviceRow {
  id: string;
  device_type: string;
  push_token: string;
  app_version: string | null;
  last_seen_at: Date;
  created_at: Date;
}

const DEVICE_COLUMNS =
  'id, device_type, push_token, app_version, last_seen_at, created_at';

// Every query is keyed on the user and tenant: people only ever see and
// change their own devices. Run inside withTenant(caller).

export const listPushDevices = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<PushDeviceRow[]> => {
  const result = await client.query<PushDeviceRow>(
    `SELECT ${DEVICE_COLUMNS} FROM device_registrations
     WHERE tenant_id = $1 AND user_id = $2 ORDER BY last_seen_at DESC`,
    [params.tenantId, params.userId],
  );
  return result.rows;
};

// Registering a token again (every app start) just refreshes it.
export const upsertPushDevice = async (
  client: PoolClient,
  params: {
    tenantId: string;
    userId: string;
    deviceType: string;
    pushToken: string;
    appVersion: string | null;
  },
): Promise<PushDeviceRow> => {
  const result = await client.query<PushDeviceRow>(
    `INSERT INTO device_registrations (tenant_id, user_id, device_type, push_token, app_version)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, push_token) DO UPDATE
       SET device_type = EXCLUDED.device_type, app_version = EXCLUDED.app_version,
           last_seen_at = now(), updated_at = now()
     RETURNING ${DEVICE_COLUMNS}`,
    [
      params.tenantId,
      params.userId,
      params.deviceType,
      params.pushToken,
      params.appVersion,
    ],
  );
  return result.rows[0];
};

export const deletePushDevice = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; deviceId: string },
): Promise<boolean> => {
  const result = await client.query(
    `DELETE FROM device_registrations WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
    [params.deviceId, params.tenantId, params.userId],
  );
  return (result.rowCount ?? 0) > 0;
};
