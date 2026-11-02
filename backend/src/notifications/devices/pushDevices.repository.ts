import { PoolClient } from 'pg';

export interface PushDeviceRow {
  id: string;
  device_type: string;
  push_token: string;
  app_version: string | null;
  bundle_id: string | null;
  apns_environment: 'sandbox' | 'production' | null;
  endpoint_arn: string | null;
  disabled_at: Date | null;
  last_seen_at: Date;
  created_at: Date;
}

const DEVICE_COLUMNS = `id, device_type, push_token, app_version, bundle_id,
  apns_environment, endpoint_arn, disabled_at, last_seen_at, created_at`;

// Every query is keyed on the user and tenant: people only ever see and
// change their own devices. Run inside withTenant(caller), or withActor
// for registering.

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

// Registering a token again (every app start, every sign-in) refreshes
// it; a token another person held (a shared phone) moves to the caller
// (register_push_device(), migration 0112). Needs withActor.
export const registerPushDevice = async (
  client: PoolClient,
  params: {
    deviceType: string;
    pushToken: string;
    appVersion: string | null;
    bundleId: string | null;
    apnsEnvironment: 'sandbox' | 'production' | null;
  },
): Promise<PushDeviceRow> => {
  const result = await client.query<PushDeviceRow>(
    'SELECT * FROM register_push_device($1, $2, $3, $4, $5)',
    [
      params.deviceType,
      params.pushToken,
      params.appVersion,
      params.bundleId,
      params.apnsEnvironment,
    ],
  );
  return result.rows[0];
};

// The SNS endpoint for a device, enabled again.
export const saveEndpoint = async (
  client: PoolClient,
  params: { tenantId: string; deviceId: string; endpointArn: string },
): Promise<void> => {
  await client.query(
    `UPDATE device_registrations SET endpoint_arn = $3, disabled_at = NULL, updated_at = now()
     WHERE id = $1 AND tenant_id = $2`,
    [params.deviceId, params.tenantId, params.endpointArn],
  );
};

export const findPushDevice = async (
  client: PoolClient,
  params: { tenantId: string; userId: string; deviceId: string },
): Promise<PushDeviceRow | undefined> => {
  const result = await client.query<PushDeviceRow>(
    `SELECT ${DEVICE_COLUMNS} FROM device_registrations
     WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
    [params.deviceId, params.tenantId, params.userId],
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

// Devices a push can go to: an SNS endpoint SNS hasn't disabled.
export const listPushableDevices = async (
  client: PoolClient,
  params: { tenantId: string; userId: string },
): Promise<PushDeviceRow[]> => {
  const result = await client.query<PushDeviceRow>(
    `SELECT ${DEVICE_COLUMNS} FROM device_registrations
     WHERE tenant_id = $1 AND user_id = $2
       AND endpoint_arn IS NOT NULL AND disabled_at IS NULL`,
    [params.tenantId, params.userId],
  );
  return result.rows;
};

export const markDeviceDisabled = async (
  client: PoolClient,
  params: { tenantId: string; deviceId: string },
): Promise<void> => {
  await client.query(
    `UPDATE device_registrations SET disabled_at = now(), updated_at = now()
     WHERE id = $1 AND tenant_id = $2`,
    [params.deviceId, params.tenantId],
  );
};

export const deleteDeviceById = async (
  client: PoolClient,
  params: { tenantId: string; deviceId: string },
): Promise<void> => {
  await client.query(
    `DELETE FROM device_registrations WHERE id = $1 AND tenant_id = $2`,
    [params.deviceId, params.tenantId],
  );
};
