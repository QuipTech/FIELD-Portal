import { PoolClient } from 'pg';

// Active machines on one billing day, by the peak rule (spec section 3):
// activated_on <= day and (billing_end is null or day < billing_end).
// Distinct machines, so a machine deactivated and reactivated in the same
// month (two intervals overlapping to month end) counts once.
export const countActiveMachinesOnDay = async (
  client: PoolClient,
  billingAccountId: string,
  day: string,
): Promise<number> => {
  const result = await client.query<{ count: string }>(
    `SELECT count(DISTINCT machine_id) AS count
     FROM billing.machine_activations
     WHERE billing_account_id = $1 AND deleted_at IS NULL
       AND activated_on <= $2::date
       AND (billing_end IS NULL OR $2::date < billing_end)`,
    [billingAccountId, day],
  );
  return Number(result.rows[0]?.count ?? 0);
};

// Applies one transition through billing.apply_machine_transition
// (migration 0097). The new lifecycle event's id, or null when the machine
// isn't in that organisation or has already left `fromState`.
export const applyMachineTransition = async (
  client: PoolClient,
  params: {
    machineId: string;
    tenantId: string;
    billingAccountId: string;
    fromState: string;
    toState: string;
    activatedOn: string | null;
    billingEnd: string | null;
    actorUserId: string | null;
    reason: string | null;
    transferId: string | null;
  },
): Promise<string | null> => {
  const result = await client.query<{ event_id: string | null }>(
    `SELECT billing.apply_machine_transition($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS event_id`,
    [
      params.machineId,
      params.tenantId,
      params.billingAccountId,
      params.fromState,
      params.toState,
      params.activatedOn,
      params.billingEnd,
      params.actorUserId,
      params.reason,
      params.transferId,
    ],
  );
  return result.rows[0]?.event_id ?? null;
};
