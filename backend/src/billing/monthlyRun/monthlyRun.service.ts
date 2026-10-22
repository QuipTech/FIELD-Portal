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
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { sumAmountCents } from '../invoices/invoiceAmounts';
import * as countsRepository from './dailyBillableCounts.repository';
import { buildDailyCounts } from './dailyCountRules';
import { calculateMonthlyLines } from './monthlyLineCalculation';
import * as runInvoicesRepository from './runInvoices.repository';
import { RunSubscription } from './monthlyRunTypes';

const HOUR_MS = 60 * 60 * 1000;

// Monthly run, steps 1 and 2 (billing spec section 9), per billing account
// in its own time zone: snapshot every finished day, then once the month
// has closed, draft its invoice in arrears. Safe to repeat: snapshots never
// overwrite and a month is drafted once (uq_invoices_account_period).
@Injectable()
export class MonthlyRunService {
  private readonly logger = new Logger(MonthlyRunService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingConfig: BillingConfigService,
    private readonly priceBooks: PriceBooksService,
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
        await runInvoicesRepository.hasRunInvoice(
          client,
          account.id,
          periodStart,
        )
      )
        return null;
      const subscriptions = await this.loadSubscriptions(
        client,
        account,
        periodStart,
        periodEnd,
      );
      const counts = await countsRepository.listDailyCounts(
        client,
        account.id,
        periodStart,
        periodEnd,
      );
      const lines = calculateMonthlyLines({
        periodStart,
        periodEnd,
        counts,
        subscriptions,
      });
      if (lines.length === 0) return null;
      const totalExGstCents = sumAmountCents(lines.map((l) => l.amountCents));
      const invoiceId = await runInvoicesRepository.insertRunInvoice(client, {
        billingAccountId: account.id,
        periodStart,
        periodEnd,
        reviewUntil: new Date(
          now.getTime() + config.INVOICE_REVIEW_HOURS * HOUR_MS,
        ),
        totalExGstCents,
        lines,
      });
      await recordBillingAudit(client, null, {
        action: 'create',
        entityType: 'billing_invoice',
        entityId: invoiceId,
        billingAccountId: account.id,
        from: null,
        to: { status: 'draft', periodStart, periodEnd, totalExGstCents },
        reason: 'monthly billing run',
        metadata: { lineCount: lines.length },
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
