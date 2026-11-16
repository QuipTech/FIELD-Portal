import { ForbiddenException } from '@nestjs/common';
import { PoolClient } from 'pg';

export const MACHINE_CONTROL_DISABLED_CODE = 'machine_control_disabled';
const MACHINE_CONTROL_DISABLED_MESSAGE =
  "Machine Control isn't turned on for your organisation. Ask QuipTech to turn it on.";

export const MC_PERMISSIONS = {
  view: 'mc.view',
  upload: 'mc.upload',
  deliver: 'mc.deliver',
  manageDevices: 'mc.manage_devices',
  remote: 'mc.remote',
} as const;

export const isMachineControlEnabled = async (
  client: PoolClient,
  tenantId: string,
): Promise<boolean> => {
  const result = await client.query<{ machine_control_enabled: boolean }>(
    'SELECT machine_control_enabled FROM tenants WHERE id = $1',
    [tenantId],
  );
  return result.rows[0]?.machine_control_enabled ?? false;
};

// The caller's own organisation decides, also on a machine shared with it.
export const assertMachineControlEnabled = async (
  client: PoolClient,
  tenantId: string,
): Promise<void> => {
  if (!(await isMachineControlEnabled(client, tenantId))) {
    throw new ForbiddenException({
      code: MACHINE_CONTROL_DISABLED_CODE,
      message: MACHINE_CONTROL_DISABLED_MESSAGE,
    });
  }
};
