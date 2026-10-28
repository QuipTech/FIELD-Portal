import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { findEnterpriseQuoteProblem } from '../pricing/enterpriseRules';
import { PLAN_CODES } from './planCodes';
import {
  endReplacedSubscription,
  lockLiveSubscription,
} from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from './subscriptionTypes';

const NO_MINIMUM_MESSAGE = 'The Enterprise price book has no annual minimum.';

export interface EnterpriseContractInput {
  annualQuoteCents: number;
  committedMachines: number;
  reason: string;
}

// Sets up a quoted Enterprise contract (super admin). A quote below the
// pinned price book's annual minimum is rejected (T8a). The account's
// self-serve ASSET_PRO subscription ends the day the contract starts.
@Injectable()
export class EnterpriseContractService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccountsService: BillingAccountsService,
    private readonly priceBooksService: PriceBooksService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  setUpContract = async (
    actor: BillingActor,
    billingAccountId: string,
    input: EnterpriseContractInput,
    now = new Date(),
  ): Promise<Subscription> => {
    const account =
      await this.billingAccountsService.requireAccount(billingAccountId);
    const plan = await this.subscriptionsService.planNewTerm(
      PLAN_CODES.enterprise,
      { term: 'annual', committedQty: input.committedMachines },
      account.timezone,
      now,
    );
    const priceBook = await this.priceBooksService.getPinnedPriceBook(
      plan.priceBookId,
    );
    if (priceBook.minimumAnnualCents === null)
      throw new NotFoundException(NO_MINIMUM_MESSAGE);
    const problem = findEnterpriseQuoteProblem(
      input.annualQuoteCents,
      priceBook.minimumAnnualCents,
    );
    if (problem) throw new BadRequestException(problem);

    return this.serviceDatabase.transaction(async (client) => {
      const selfServe = await lockLiveSubscription(
        client,
        account.id,
        PLAN_CODES.assetPro,
      );
      if (selfServe) {
        await endReplacedSubscription(client, selfServe.id, plan.periodStart);
        await recordBillingAudit(client, actor, {
          action: 'update',
          entityType: 'billing_subscription',
          entityId: selfServe.id,
          billingAccountId: account.id,
          from: { planCode: PLAN_CODES.assetPro, status: selfServe.status },
          to: { status: 'cancelled', endedOn: plan.periodStart },
          reason: 'replaced by Enterprise contract',
        });
      }
      return this.subscriptionsService.createSubscription(client, actor, {
        billingAccountId: account.id,
        planCode: PLAN_CODES.enterprise,
        plan,
        contractAnnualCents: input.annualQuoteCents,
        reason: input.reason,
      });
    });
  };
}
