import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { listDaysBetween } from '../billingCalendar/billableInterval';
import {
  addDaysToDay,
  firstDayOfMonth,
  toBillingDay,
} from '../billingCalendar/billingDay';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { DiscountService } from '../discounts/discount.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { PLAN_CODES } from '../subscriptions/planCodes';
import { sumAmountCents } from '../invoices/invoiceAmounts';
import { usesAccountTerms } from '../accountTerms/accountTermsTypes';
import { StatementsService } from '../statements/statements.service';
import { hasRunStatement } from '../statements/statements.repository';
import * as countsRepository from './dailyBillableCounts.repository';
import {
  buildDailyCounts,
  withoutFinalChargedMachines,
} from './dailyCountRules';
import { calculateMonthlyLines } from './monthlyLineCalculation';
import * as runInvoicesRepository from './runInvoices.repository';
import { RunSubscription } from './monthlyRunTypes';

const HOUR_MS = 60 * 60 * 1000;

// Monthly run, steps 1 and 2 (billing spec section 9), per billing account
// in its own time zone: snapshot every finished day, then once the month
// has closed, draft its invoice in arrears (a 30-day account gets a Zoho
// statement instead). Safe to repeat: snapshots never
// overwrite and a month is drafted once (uq_invoices_account_period).
@Injectable()
export class MonthlyRunService {
  private readonly logger = new Logger(MonthlyRunService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly priceBooks: PriceBooksService,
    private readonly discounts: DiscountService,
    private readonly statements: StatementsService,
  ) {}

  runAllAccounts = async (now: Date): Promise<string[]> => {
    const accounts = await countsRepository.listRunAccounts(
      this.serviceDatabase,
    );
    const drafted: string[] = [];
    for (const account of accounts) {
      try {
        const invoiceId = await this.runAccount(account, now);
        if (invoiceId) drafted.push(invoiceId);
      } catch (error) {
        this.logger.error(
          `Billing run failed for account ${account.id}: ${String(error)}`,
        );
      }
    }
    return drafted;
  };

  // The new draft's id, or null when there was nothing (more) to invoice.
  runAccount = async (
    account: countsRepository.RunAccountRow,
    now: Date,
  ): Promise<string | null> => {
    const today = toBillingDay(now, account.timezone);
    const periodEnd = firstDayOfMonth(today);
    const periodStart = firstDayOfMonth(addDaysToDay(periodEnd, -1));
    const config = await this.billingConfig.loadConfig();
    return this.serviceDatabase.transaction(async (client) => {
      // Several API containers run the job: one at a time per account.
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`billing-run:${account.id}`],
      );
      await this.writeSnapshots(client, account.id, periodStart, today);
      if (
        (await runInvoicesRepository.hasRunInvoice(
          client,
          account.id,
          periodStart,
        )) ||
        (await hasRunStatement(client, account.id, periodStart))
      )
        return null;
      // With no user paywall (REQUIRE_USER_SUBSCRIPTION off) only active
      // machines are billed: TECH seats add nothing.
      const subscriptions = (
        await this.loadSubscriptions(client, account, periodStart, periodEnd)
      ).filter(
        (subscription) =>
          config.REQUIRE_USER_SUBSCRIPTION ||
          subscription.planCode !== PLAN_CODES.tech,
      );
      const counts = await countsRepository.listDailyCounts(
        client,
        account.id,
        periodStart,
        periodEnd,
      );
      const finalCharged =
        await runInvoicesRepository.listFinalChargedIntervals(
          client,
          account.id,
          periodStart,
          periodEnd,
        );
      const charges = calculateMonthlyLines({
        periodStart,
        periodEnd,
        counts: withoutFinalChargedMachines(counts, finalCharged),
        subscriptions,
      });
      if (charges.length === 0) return null;
      // Free period first, then promo; never below A$0.
      const discounts = await this.discounts.discountLinesForMonth(
        client,
        account.id,
        periodStart,
        charges,
      );
      const lines = [...charges, ...discounts];
      // A 30-day account is invoiced in Zoho: the month goes on its
      // statement for the month-end report, and nothing reaches Stripe.
      if (usesAccountTerms(account))
        return this.statements.addCharges(client, null, {
          billingAccountId: account.id,
          periodStart,
          lines,
          reason: 'monthly billing run (30-day account statement)',
          markRun: true,
        });
      const totalExGstCents = Math.max(
        0,
        sumAmountCents(lines.map((l) => l.amountCents)),
      );
      // A month discounted to A$0 is kept, with its lines, but never sent.
      const noCharge = totalExGstCents === 0;
      const invoiceId = await runInvoicesRepository.insertRunInvoice(client, {
        billingAccountId: account.id,
        periodStart,
        periodEnd,
        reviewUntil: noCharge
          ? null
          : new Date(now.getTime() + config.INVOICE_REVIEW_HOURS * HOUR_MS),
        totalExGstCents,
        lines,
      });
      if (noCharge)
        await runInvoicesRepository.markNoCharge(
          client,
          invoiceId,
          'fully_discounted',
        );
      await recordBillingAudit(client, null, {
        action: 'create',
        entityType: 'billing_invoice',
        entityId: invoiceId,
        billingAccountId: account.id,
        from: null,
        to: {
          status: noCharge ? 'paid' : 'draft',
          periodStart,
          periodEnd,
          totalExGstCents,
        },
        reason: noCharge
          ? 'monthly billing run: discounted to A$0, not sent'
          : 'monthly billing run',
        metadata: {
          lineCount: lines.length,
          discountLines: discounts.length,
          machinesWithFinalCharge: finalCharged.length,
        },
      });
      return invoiceId;
    });
  };

  // Every finished day from the closing month's start up to yesterday.
  private writeSnapshots = async (
    client: PoolClient,
    billingAccountId: string,
    from: string,
    today: string,
  ): Promise<void> => {
    const intervals = await countsRepository.listBillableIntervals(
      client,
      billingAccountId,
      from,
      today,
    );
    await countsRepository.insertDailyCounts(
      client,
      billingAccountId,
      buildDailyCounts(
        intervals.machines,
        intervals.seats,
        listDaysBetween(from, today),
      ),
    );
  };

  private loadSubscriptions = async (
    client: PoolClient,
    account: countsRepository.RunAccountRow,
    periodStart: string,
    periodEnd: string,
  ): Promise<RunSubscription[]> => {
    const rows = await runInvoicesRepository.listSubscriptionsForPeriod(
      client,
      account.id,
      account.timezone,
      periodStart,
      periodEnd,
    );
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        planCode: row.plan_code,
        term: row.term,
        committedQty: row.committed_qty,
        annualMonthsCharged: row.annual_months_charged,
        book: await this.priceBooks.getPinnedPriceBook(row.price_book_id),
      })),
    );
  };
}
