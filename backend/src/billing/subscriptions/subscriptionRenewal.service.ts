import { Injectable, Logger } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { toBillingDay } from '../billingCalendar/billingDay';
import { listRunAccounts } from '../monthlyRun/dailyBillableCounts.repository';
import { UpFrontInvoiceService } from '../invoices/upFrontInvoice.service';
import { PLAN_CODES } from './planCodes';
import { toSubscription } from './subscriptionMapper';
import { Subscription } from './subscriptionTypes';
import { SubscriptionsService } from './subscriptions.service';
import * as subscriptionsRepository from './subscriptions.repository';

// A subscription a long way behind (the job was off) catches up one term
// at a time, at most this many per run.
const MAX_TERMS_PER_RUN = 24;

// Renewal and cancellation day, per account in its own time zone (hourly,
// after the closed month is drafted so that month is billed on the term it
// was in). Each ended term renews with the price book in effect (T27) and
// the customer's chosen next term; an annual term is invoiced up front.
// A cancellation ends the subscription on cancel_at.
@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly subscriptions: SubscriptionsService,
    private readonly upFrontInvoices: UpFrontInvoiceService,
  ) {}

  // Every organisation account; run after the closed months are drafted.
  renewAllAccounts = async (now: Date): Promise<number> => {
    const accounts = await listRunAccounts(this.serviceDatabase);
    let changed = 0;
    for (const account of accounts) {
      try {
        changed += await this.renewDue(account, now);
      } catch (error) {
        this.logger.error(
          `Renewal failed for account ${account.id}: ${String(error)}`,
        );
      }
    }
    return changed;
  };

  // How many terms were renewed or ended.
  renewDue = async (
    account: { id: string; timezone: string },
    now: Date,
  ): Promise<number> => {
    const today = toBillingDay(now, account.timezone);
    let changed = 0;
    for (let round = 0; round < MAX_TERMS_PER_RUN; round++) {
      const due = (
        await subscriptionsRepository.listSubscriptionsDue(
          this.serviceDatabase,
          account.id,
          today,
        )
      ).map(toSubscription);
      let progressed = false;
      for (const subscription of due) {
        if (await this.renewOrEnd(subscription, today)) {
          progressed = true;
          changed++;
        }
      }
      if (!progressed) break;
    }
    return changed;
  };

  private renewOrEnd = async (
    subscription: Subscription,
    today: string,
  ): Promise<boolean> => {
    if (subscription.status === 'cancelling') {
      if (!subscription.cancelAt || subscription.cancelAt > today) return false;
      await this.subscriptions.completeCancellation(subscription);
      return true;
    }
    const currentCount = await this.countBillableToday(subscription, today);
    const renewed = await this.subscriptions.renewSubscription(
      null,
      subscription.id,
      { currentCount, requestedQty: null },
    );
    if (renewed.term === 'annual')
      await this.upFrontInvoices.invoiceAnnualTerm(renewed);
    return true;
  };

  // Q resets to the current count at renewal: active machines for
  // ASSET_PRO, held seats for TECH.
  private countBillableToday = async (
    subscription: Subscription,
    today: string,
  ): Promise<number> => {
    const sql =
      subscription.planCode === PLAN_CODES.tech
        ? `SELECT count(*) AS count FROM billing.seats
           WHERE billing_account_id = $1 AND deleted_at IS NULL
             AND started_on <= $2::date AND (billing_end IS NULL OR $2::date < billing_end)`
        : `SELECT count(DISTINCT machine_id) AS count FROM billing.machine_activations
           WHERE billing_account_id = $1 AND deleted_at IS NULL
             AND activated_on <= $2::date AND (billing_end IS NULL OR $2::date < billing_end)`;
    const result = await this.serviceDatabase.query<{ count: string }>(sql, [
      subscription.billingAccountId,
      today,
    ]);
    return Number(result.rows[0]?.count ?? 0);
  };
}
