import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';

export type MachineAccessLevel = 'owner' | 'contribute' | 'view';

// The person's access to one machine. tenantId is the OWNING organisation:
// rows about the machine (history, photos, cases) live there, also when a
// shared person with 'contribute' adds them.
export interface MachineAccessGrant {
  machineId: string;
  tenantId: string;
  accessLevel: MachineAccessLevel;
  isShared: boolean;
}

// What the request needs: to read, to add history/photos/cases, or to
// change the machine itself (own organisation only).
export type MachineAccessNeed = 'read' | 'contribute' | 'manage';

const MACHINE_NOT_FOUND_MESSAGE = 'Machine not found.';
const VIEW_ONLY_MESSAGE =
  'You have view-only access to this machine, so you can’t add to it.';

interface AccessRow {
  machine_id: string;
  tenant_id: string;
  access_level: MachineAccessLevel;
  is_shared: boolean;
}

const toGrant = (row: AccessRow): MachineAccessGrant => ({
  machineId: row.machine_id,
  tenantId: row.tenant_id,
  accessLevel: row.access_level,
  isShared: row.is_shared,
});

// getAccessibleMachines: every machine the signed-in person may see
// (accessible_machines(), migration 0116), with their level.
export const getAccessibleMachines = async (
  client: PoolClient,
): Promise<MachineAccessGrant[]> => {
  const result = await client.query<AccessRow>(
    'SELECT machine_id, tenant_id, access_level, is_shared FROM accessible_machines()',
  );
  return result.rows.map(toGrant);
};

export const findMachineAccess = async (
  client: PoolClient,
  machineId: string,
): Promise<MachineAccessGrant | null> => {
  const result = await client.query<AccessRow>(
    `SELECT a.machine_id, a.tenant_id, a.access_level, a.is_shared
     FROM accessible_machines() a
     JOIN machines m ON m.id = a.machine_id AND m.deleted_at IS NULL
     WHERE a.machine_id = $1`,
    [machineId],
  );
  return result.rows[0] ? toGrant(result.rows[0]) : null;
};

// A machine outside the person's access, or one they'd need to own, is a
// 404 (it doesn't exist for them); a view-only share asked to contribute
// is a 403.
export const requireMachineAccess = async (
  client: PoolClient,
  machineId: string,
  need: MachineAccessNeed = 'read',
): Promise<MachineAccessGrant> => {
  const grant = await findMachineAccess(client, machineId);
  if (!grant || (need === 'manage' && grant.isShared)) {
    throw new NotFoundException(MACHINE_NOT_FOUND_MESSAGE);
  }
  if (need === 'contribute' && grant.accessLevel === 'view') {
    throw new ForbiddenException(VIEW_ONLY_MESSAGE);
  }
  return grant;
};
