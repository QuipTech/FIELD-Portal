import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { insertReviewTaskOnce, ReviewTaskType } from './reviewTasks.repository';

// Review tasks for QuipTech (or the partner): plan reviews, the
// Enterprise threshold, abuse flags. Raising one never blocks the change
// that triggered it.
@Injectable()
export class ReviewTasksService {
  // Inside the caller's transaction. True when a new task was raised,
  // false when the account already had one open of that type.
  raiseOnce = async (
    client: PoolClient,
    actor: BillingActor | null,
    params: {
      billingAccountId: string;
      type: ReviewTaskType;
      reason: string;
      details: Record<string, unknown>;
    },
  ): Promise<boolean> => {
    const taskId = await insertReviewTaskOnce(client, params);
    if (!taskId) return false;
    await recordBillingAudit(client, actor, {
      action: 'create',
      entityType: 'billing_review_task',
      entityId: taskId,
      billingAccountId: params.billingAccountId,
      from: null,
      to: { type: params.type, status: 'open' },
      reason: params.reason,
      metadata: params.details,
    });
    return true;
  };
}
