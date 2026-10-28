import { PoolClient } from 'pg';

export type ReviewTaskType =
  'plan_review' | 'enterprise_threshold' | 'abuse_flag';

// Creates the task unless the account already has one open of that type
// (uq_review_tasks_open_type, migration 0097). The new task's id, or null
// when one was already open.
export const insertReviewTaskOnce = async (
  client: PoolClient,
  params: {
    billingAccountId: string;
    type: ReviewTaskType;
    reason: string;
    details: Record<string, unknown>;
  },
): Promise<string | null> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO billing.review_tasks (billing_account_id, type, reason, details)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (billing_account_id, type)
       WHERE status IN ('open', 'in_progress') AND deleted_at IS NULL
     DO NOTHING
     RETURNING id`,
    [params.billingAccountId, params.type, params.reason, params.details],
  );
  return result.rows[0]?.id ?? null;
};
