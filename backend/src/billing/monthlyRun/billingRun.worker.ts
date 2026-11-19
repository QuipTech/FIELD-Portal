import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AllowanceService } from '../allowance/allowance.service';
import { OverdueService } from '../collections/overdue.service';
import { SubscriptionRenewalService } from '../subscriptions/subscriptionRenewal.service';
import { InvoiceReviewService } from './invoiceReview.service';
import { MonthlyRunService } from './monthlyRun.service';
import { StatementsService } from '../statements/statements.service';

// Hourly, because each billing account closes its day and month in its own
// time zone: snapshot finished days, draft closed months, renew or end
// subscriptions whose term is over (after the drafts, so a month is billed
// on the term it was in), finalise drafts whose review window has passed,
// send payment reminders (and 30-day account statement reminders), warn about credit limits, then work out
// fair-use allowances. Every step is
// safe to repeat, and one failing never stops the others.
// It creates real Stripe invoices, so it only runs with
// BILLING_RUN_ENABLED=true.
// (Cron handlers are methods: @Cron only decorates methods.)
@Injectable()
export class BillingRunWorker {
  private readonly logger = new Logger(BillingRunWorker.name);
  private readonly isEnabled: boolean;
  private isRunning = false;

  constructor(
    private readonly monthlyRun: MonthlyRunService,
    private readonly invoiceReview: InvoiceReviewService,
    private readonly renewals: SubscriptionRenewalService,
    private readonly overdue: OverdueService,
    private readonly allowances: AllowanceService,
    private readonly statements: StatementsService,
    configService: ConfigService,
  ) {
    this.isEnabled =
      configService.get<string>('BILLING_RUN_ENABLED') === 'true';
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runBilling(): Promise<void> {
    if (!this.isEnabled || this.isRunning) return;
    this.isRunning = true;
    try {
      const now = new Date();
      const drafted = await this.step(
        'draft',
        () => this.monthlyRun.runAllAccounts(now),
        [],
      );
      const renewed = await this.step(
        'renewal',
        () => this.renewals.renewAllAccounts(now),
        0,
      );
      const finalised = await this.step(
        'finalise',
        () => this.invoiceReview.finaliseDueInvoices(now),
        [],
      );
      const notices = await this.step(
        'reminders',
        () => this.overdue.sendDueNotices(now),
        0,
      );
      const statementReminders = await this.step(
        'statement reminders',
        () => this.statements.sendDueReminders(now),
        0,
      );
      const creditWarnings = await this.step(
        'credit limit',
        () => this.overdue.checkCreditLimits(),
        0,
      );
      await this.step(
        'allowance',
        () => this.allowances.runAllAccounts(now),
        undefined,
      );
      if (
        drafted.length ||
        renewed ||
        finalised.length ||
        notices ||
        statementReminders ||
        creditWarnings
      ) {
        this.logger.log(
          `Billing run: ${drafted.length} drafted, ${renewed} renewed or ended, ${finalised.length} finalised, ${notices} reminders, ${statementReminders} statement reminders, ${creditWarnings} credit limit warnings.`,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async step<T>(
    name: string,
    work: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      this.logger.error(`Billing run (${name}) failed: ${String(error)}`);
      return fallback;
    }
  }
}
