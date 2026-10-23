import { PoolClient } from 'pg';

export interface MachineIdentifiers {
  serialNumber: string;
  fleetNumber: string | null;
  assetNumber: string | null;
  registrationNumber: string | null;
}

interface IdentifierRow {
  serial_number: string;
  fleet_number: string | null;
  asset_number: string | null;
  registration_number: string | null;
}

const toIdentifiers = (row: IdentifierRow): MachineIdentifiers => ({
  serialNumber: row.serial_number,
  fleetNumber: row.fleet_number,
  assetNumber: row.asset_number,
  registrationNumber: row.registration_number,
});

// Locks the machine and returns its identifiers, or null when it isn't in
// the organisation.
export const lockMachineIdentifiers = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<MachineIdentifiers | null> => {
  const result = await client.query<IdentifierRow>(
    `SELECT serial_number, fleet_number, asset_number, registration_number
     FROM machines
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     FOR UPDATE`,
    [machineId, tenantId],
  );
  return result.rows[0] ? toIdentifiers(result.rows[0]) : null;
};

export const saveMachineIdentifiers = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  identifiers: MachineIdentifiers,
): Promise<void> => {
  await client.query(
    `UPDATE machines
     SET serial_number = $3, fleet_number = $4, asset_number = $5,
         registration_number = $6, updated_at = now()
     WHERE id = $1 AND tenant_id = $2`,
    [
      machineId,
      tenantId,
      identifiers.serialNumber,
      identifiers.fleetNumber,
      identifiers.assetNumber,
      identifiers.registrationNumber,
    ],
  );
};
