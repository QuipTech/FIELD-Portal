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

export const MACHINE_INACTIVE_CODE = 'machine_inactive';
export const MACHINE_INACTIVE_MESSAGE =
  'Activate this machine to see full history, AI and support.';
export const PLAN_ENDED_MESSAGE =
  "Your organisation's plan has ended, so full machine history is read-only summary for now. Restart FIELD Asset Professional in Billing.";

// The machine's lifecycle state in the caller's organisation, or null when
// there is no such machine there.
const findMachineLifecycleState = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<string | null> => {
  const result = await client.query<{ lifecycle_state: string }>(
    `SELECT lifecycle_state FROM machines
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [tenantId, machineId],
  );
  return result.rows[0]?.lifecycle_state ?? null;
};

// Full history, AI context and remote sessions need an active machine
// (spec section 5). Throws 403 machine_inactive for any other state;
// 'missing' lets the caller decide what an unknown machine means.
export const assertFullMachineAccess = async (
  client: PoolClient,
  tenantId: string,
  machineId: string,
): Promise<'allowed' | 'missing'> => {
  const state = await findMachineLifecycleState(client, tenantId, machineId);
  if (state === null) return 'missing';
  if (hasFullMachineAccess(toLifecycleState(state))) {
    // An active machine on a plan that has since ended (cancelled) is
    // limited like an inactive one until the plan restarts.
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
