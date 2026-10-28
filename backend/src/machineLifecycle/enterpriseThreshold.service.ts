import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BillingActor } from '../billing/billingAudit/billingAudit';
import { BillingConfigService } from '../billing/billingConfig/billingConfig.service';
import { hasReachedEnterpriseThreshold } from '../billing/pricing/enterpriseRules';
import { ReviewTasksService } from '../billing/reviewTasks/reviewTasks.service';
import { PLAN_CODES } from '../billing/subscriptions/planCodes';
import { lockLiveSubscription } from '../billing/subscriptions/subscriptions.repository';
import { countActiveMachinesOnDay } from './machineActivations.repository';

// Spec decision (T8): a self-serve account reaching
// ENTERPRISE_THRESHOLD_MACHINES keeps billing at the top band and raises
// one sales review task. The activation itself is never refused.
@Injectable()
export class EnterpriseThresholdService {
  constructor(
    private readonly billingConfigService: BillingConfigService,
    private readonly reviewTasksService: ReviewTasksService,
  ) {}

  // Runs after an activation, inside its transaction. True when it raised
  // the sales task.
  raiseTaskIfReached = async (
    client: PoolClient,
    actor: BillingActor | null,
    billingAccountId: string,
    today: string,
  ): Promise<boolean> => {
    const selfServe = await lockLiveSubscription(
      client,
      billingAccountId,
      PLAN_CODES.assetPro,
    );
    if (!selfServe) return false;
    const [config, activeMachines] = await Promise.all([
      this.billingConfigService.loadConfig(),
      countActiveMachinesOnDay(client, billingAccountId, today),
    ]);
    if (
      !hasReachedEnterpriseThreshold(
        activeMachines,
        config.ENTERPRISE_THRESHOLD_MACHINES,
      )
    ) {
      return false;
    }
    return this.reviewTasksService.raiseOnce(client, actor, {
      billingAccountId,
      type: 'enterprise_threshold',
      reason: `Self-serve account reached ${activeMachines} active machines`,
      details: {
        activeMachines,
        thresholdMachines: config.ENTERPRISE_THRESHOLD_MACHINES,
        day: today,
      },
    });
  };
}
