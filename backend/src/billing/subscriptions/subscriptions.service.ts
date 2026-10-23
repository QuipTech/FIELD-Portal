import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { toBillingDay } from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { PinnedPriceBook } from '../pricing/pricingTypes';
import { toSubscription } from './subscriptionMapper';
import {
  planAnnualTerm,
  planCancellation,
  planMonthlyTerm,
  planRenewal,
} from './subscriptionTerms';
import { Subscription, SubscriptionTermPlan } from './subscriptionTypes';
import * as subscriptionsRepository from './subscriptions.repository';

export type TermChoice =
  { term: 'monthly' } | { term: 'annual'; committedQty: number };

const SUBSCRIPTION_NOT_FOUND_MESSAGE = 'Subscription not found.';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfigService: BillingConfigService,
    private readonly priceBooksService: PriceBooksService,
  ) {}

  listLiveSubscriptions = async (
    billingAccountId: string,
  ): Promise<Subscription[]> =>
    (
      await subscriptionsRepository.listLiveSubscriptions(
        this.serviceDatabase,
        billingAccountId,
      )
    ).map(toSubscription);

  // Always the version the subscription pinned, never the newest (T27).
  getPinnedPriceBook = (subscription: Subscription): Promise<PinnedPriceBook> =>
    this.priceBooksService.getPinnedPriceBook(subscription.priceBookId);

  // Pins the price book (and, for annual, months charged) in effect on the
  // account's billing day.
  planNewTerm = async (
    planCode: string,
    choice: TermChoice,
    timeZone: string,
    now = new Date(),
  ): Promise<SubscriptionTermPlan> => {
    const today = toBillingDay(now, timeZone);
    const priceBook = await this.priceBooksService.getPriceBookInEffect(
      planCode,
      today,
    );
    if (choice.term === 'monthly') return planMonthlyTerm(today, priceBook.id);
    const config = await this.billingConfigService.loadConfig();
    return planAnnualTerm(
      today,
      priceBook.id,
      choice.committedQty,
      config.ANNUAL_MONTHS_CHARGED,
    );
  };

  // Runs inside the caller's transaction, so the subscription, the change
  // that needed it and the audit entry are saved together.
  createSubscription = async (
    client: PoolClient,
    actor: BillingActor | null,
    params: {
      billingAccountId: string;
      planCode: string;
      plan: SubscriptionTermPlan;
      contractAnnualCents?: number;
      reason: string;
    },
  ): Promise<Subscription> => {
    const row = await subscriptionsRepository.insertSubscription(client, {
      billingAccountId: params.billingAccountId,
      planCode: params.planCode,
      plan: params.plan,
      contractAnnualCents: params.contractAnnualCents ?? null,
      createdBy: actor?.userId ?? null,
    });
    const subscription = toSubscription(row);
    await recordBillingAudit(client, actor, {
      action: 'create',
      entityType: 'billing_subscription',
      entityId: subscription.id,
      billingAccountId: params.billingAccountId,
      from: null,
      to: this.describe(subscription),
      reason: params.reason,
    });
    return subscription;
  };

  // currentCount is the account's active machines (or held seats for
  // TECH) on renewal day; requestedQty is the customer's choice of Q.
  renewSubscription = async (
    actor: BillingActor | null,
    subscriptionId: string,
    counts: { currentCount: number; requestedQty: number | null },
  ): Promise<Subscription> => {
    const current = await this.requireSubscription(subscriptionId);
    const [priceBook, config] = await Promise.all([
      this.priceBooksService.getPriceBookInEffect(
        current.planCode,
        current.currentPeriodEnd,
      ),
      this.billingConfigService.loadConfig(),
    ]);
    const plan = planRenewal(current, {
      priceBookInEffectId: priceBook.id,
      currentCount: counts.currentCount,
      requestedQty: counts.requestedQty,
      monthsCharged: config.ANNUAL_MONTHS_CHARGED,
    });
    return this.serviceDatabase.transaction(async (client) => {
      const renewed = toSubscription(
        await subscriptionsRepository.applyRenewal(client, current.id, plan),
      );
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_subscription',
        entityId: current.id,
        billingAccountId: current.billingAccountId,
        from: this.describe(current),
        to: this.describe(renewed),
        reason: 'renewal',
      });
      return renewed;
    });
  };

  cancelSubscription = async (
    actor: BillingActor,
    subscriptionId: string,
    reason: string,
  ): Promise<Subscription> => {
    const current = await this.requireSubscription(subscriptionId);
    const config = await this.billingConfigService.loadConfig();
    const plan = planCancellation(
      current,
      config.CANCEL_EXPORT_DAYS,
      config.CANCEL_DELETE_DAYS,
    );
    return this.serviceDatabase.transaction(async (client) => {
      const cancelling = toSubscription(
        await subscriptionsRepository.markCancelling(client, current.id, plan),
      );
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_subscription',
        entityId: current.id,
        billingAccountId: current.billingAccountId,
        from: this.describe(current),
        to: this.describe(cancelling),
        reason,
      });
      return cancelling;
    });
  };

  requireSubscription = async (subscriptionId: string) => {
    const row = await subscriptionsRepository.findSubscriptionById(
      this.serviceDatabase,
      subscriptionId,
    );
    if (!row) throw new NotFoundException(SUBSCRIPTION_NOT_FOUND_MESSAGE);
    return toSubscription(row);
  };

  // The fields an audit entry's from/to records.
  private describe = (subscription: Subscription) => ({
    planCode: subscription.planCode,
    term: subscription.term,
    status: subscription.status,
    priceBookId: subscription.priceBookId,
    committedQty: subscription.committedQty,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    cancelAt: subscription.cancelAt,
  });
}
