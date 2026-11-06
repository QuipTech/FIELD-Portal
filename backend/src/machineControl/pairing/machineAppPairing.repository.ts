import { PoolClient } from 'pg';

export interface MachineAppDeviceRow {
  id: string;
  serial_number: string | null;
  platform: string | null;
  app_version: string | null;
  paired_at: Date;
}

export const findConnectedDevice = async (
  client: PoolClient,
  machineId: string,
): Promise<MachineAppDeviceRow | null> => {
  const result = await client.query<MachineAppDeviceRow>(
    `SELECT id, serial_number, platform, app_version, paired_at FROM mc_devices
     WHERE machine_id = $1 AND disabled_at IS NULL AND deleted_at IS NULL`,
    [machineId],
  );
  return result.rows[0] ?? null;
};

// Null when the code is already live somewhere else.
export const issuePairingCode = async (
  client: PoolClient,
  machineId: string,
  code: string,
): Promise<Date | null> => {
  const result = await client.query<{ expires_at: Date | null }>(
    'SELECT mc_issue_pairing_code($1, $2) AS expires_at',
    [machineId, code],
  );
  return result.rows[0].expires_at;
};

export const pairDevice = async (
  client: PoolClient,
  params: {
    code: string;
    tokenHash: string;
    serialNumber: string | null;
    platform: string | null;
    appVersion: string | null;
  },
): Promise<{
  device_id: string;
  machine_id: string;
  machine_label: string;
} | null> => {
  const result = await client.query<{
    device_id: string;
    machine_id: string;
    machine_label: string;
  }>('SELECT * FROM mc_pair_device($1, $2, $3, $4, $5)', [
    params.code,
    params.tokenHash,
    params.serialNumber,
    params.platform,
    params.appVersion,
  ]);
  return result.rows[0] ?? null;
};

export const disconnectMachineApp = async (
  client: PoolClient,
  machineId: string,
): Promise<boolean> => {
  const result = await client.query<{ was_connected: boolean }>(
    'SELECT mc_disconnect_machine_app($1) AS was_connected',
    [machineId],
  );
  return result.rows[0].was_connected;
};
