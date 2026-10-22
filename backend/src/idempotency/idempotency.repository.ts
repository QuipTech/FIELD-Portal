import { PoolClient } from 'pg';

// A claim left in progress this long (a crashed request) can be retried.
const STALE_CLAIM_INTERVAL = "interval '2 minutes'";

export interface IdempotencyKeyRef {
  tenantId: string;
  userId: string;
  key: string;
}

export type ClaimOutcome =
  | { state: 'claimed' }
  | { state: 'in_progress'; route: string }
  | { state: 'done'; route: string; status: number; body: unknown };

// Run each inside withTenant(caller), separately from the request's own
// transaction, so the claim is visible to a concurrent retry.

export const claimKey = async (
  client: PoolClient,
  ref: IdempotencyKeyRef & { route: string },
): Promise<ClaimOutcome> => {
  const claimed = await client.query(
    `INSERT INTO idempotency_keys (user_id, key, tenant_id, route)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, key) DO UPDATE
       SET route = EXCLUDED.route, created_at = now()
       WHERE idempotency_keys.status = 'in_progress'
         AND idempotency_keys.route = EXCLUDED.route
         AND idempotency_keys.created_at < now() - ${STALE_CLAIM_INTERVAL}
     RETURNING 1`,
    [ref.userId, ref.key, ref.tenantId, ref.route],
  );
  if (claimed.rowCount) return { state: 'claimed' };
  const existing = await client.query<{
    status: 'in_progress' | 'done';
    route: string;
    response_status: number | null;
    response_body: unknown;
  }>(
    `SELECT status, route, response_status, response_body FROM idempotency_keys
     WHERE user_id = $1 AND key = $2 AND tenant_id = $3`,
    [ref.userId, ref.key, ref.tenantId],
  );
  const row = existing.rows[0];
  return row.status === 'done'
    ? {
        state: 'done',
        route: row.route,
        status: row.response_status ?? 200,
        body: row.response_body,
      }
    : { state: 'in_progress', route: row.route };
};

export const completeKey = async (
  client: PoolClient,
  ref: IdempotencyKeyRef & { status: number; body: unknown },
): Promise<void> => {
  await client.query(
    `UPDATE idempotency_keys
     SET status = 'done', response_status = $4, response_body = $5::jsonb, completed_at = now()
     WHERE user_id = $1 AND key = $2 AND tenant_id = $3`,
    [
      ref.userId,
      ref.key,
      ref.tenantId,
      ref.status,
      JSON.stringify(ref.body ?? null),
    ],
  );
};

// A failed request frees its key, so the outbox can retry it.
export const releaseKey = async (
  client: PoolClient,
  ref: IdempotencyKeyRef,
): Promise<void> => {
  await client.query(
    `DELETE FROM idempotency_keys
     WHERE user_id = $1 AND key = $2 AND tenant_id = $3 AND status = 'in_progress'`,
    [ref.userId, ref.key, ref.tenantId],
  );
};
