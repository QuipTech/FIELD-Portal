import { ForbiddenException } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  hasFullMachineAccess,
  toLifecycleState,
} from '../lifecycleTransitions';
import { readFeatureKeys } from '../../entitlements/entitlements.service';
import {
  FEATURE_KEYS,
  FEATURE_REQUIRED_CODE,
} from '../../entitlements/featureKeys';
import {
  MachineScope,
  visibleMachineSql,
} from '../../machineSharing/access/machineScope';

export const MACHINE_INACTIVE_CODE = 'machine_inactive';
export const MACHINE_INACTIVE_MESSAGE =
  'Activate this machine to see full history, AI and support.';
export const PLAN_ENDED_MESSAGE =
  "Your organisation's plan has ended, so full machine history is read-only summary for now. Restart FIELD Asset Professional in Billing.";

// The machine's lifecycle state, and whether another organisation owns it
// (shared with the caller); null when it's outside the caller's machine
// scope (so a hidden machine is a 404, never a 403 that gives it away).
const findMachineLifecycleState = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  scope: MachineScope,
): Promise<{ lifecycle_state: string; is_shared: boolean } | null> => {
  const result = await client.query<{
    lifecycle_state: string;
    is_shared: boolean;
  }>(
    `SELECT m.lifecycle_state, m.tenant_id <> $1 AS is_shared FROM machines m
     WHERE m.id = $2 AND m.deleted_at IS NULL
       AND ${visibleMachineSql('m', '$1', scope)}`,
    [tenantId, machineId],
  );
  return result.rows[0] ?? null;
};

// Full history, AI context and remote sessions need an active machine
// (spec section 5). Throws 403 machine_inactive for any other state;
// 'missing' lets the caller decide what an unknown machine means.
export const assertFullMachineAccess = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
  scope: MachineScope,
): Promise<'allowed' | 'missing'> => {
  const machine = await findMachineLifecycleState(
    client,
    tenantId,
    machineId,
    scope,
  );
  if (machine === null) return 'missing';
  if (hasFullMachineAccess(toLifecycleState(machine.lifecycle_state))) {
    // An active machine on a plan that has since ended (cancelled) is
    // limited like an inactive one until the plan restarts. A shared
    // machine is its owner's to pay for: active is enough.
    if (machine.is_shared) return 'allowed';
    if ((await readFeatureKeys(client)).has(FEATURE_KEYS.assetHistory))
      return 'allowed';
    throw new ForbiddenException({
      statusCode: 403,
      code: FEATURE_REQUIRED_CODE,
      feature: FEATURE_KEYS.assetHistory,
      message: PLAN_ENDED_MESSAGE,
    });
  }
  throw new ForbiddenException({
    statusCode: 403,
    code: MACHINE_INACTIVE_CODE,
    message: MACHINE_INACTIVE_MESSAGE,
  });
};
