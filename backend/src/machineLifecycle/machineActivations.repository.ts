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

// The month's peak so far: the most machines active on any day from the
// first of the month to today. Deactivated machines still count on the
// days they were active, so this can be above today's count.
export const findPeakSoFar = async (
  client: PoolClient,
  billingAccountId: string,
  monthStart: string,
  today: string,
): Promise<number> => {
  const result = await client.query<{ peak: string | null }>(
    `SELECT max(daily.count) AS peak FROM (
       SELECT count(DISTINCT a.machine_id) AS count
       FROM generate_series($2::date, $3::date, interval '1 day') AS d(day)
       LEFT JOIN billing.machine_activations a
         ON a.billing_account_id = $1 AND a.deleted_at IS NULL
        AND a.activated_on <= d.day
        AND (a.billing_end IS NULL OR d.day < a.billing_end)
       GROUP BY d.day
     ) daily`,
    [billingAccountId, monthStart, today],
  );
  return Number(result.rows[0]?.peak ?? 0);
};
