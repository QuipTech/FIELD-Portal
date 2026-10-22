import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceReviewService } from './invoiceReview.service';
import { MonthlyRunService } from './monthlyRun.service';

// Hourly, because each billing account closes its day and month in its own
// time zone: snapshot finished days, draft closed months, then finalise
// drafts whose review window has passed. Every step is safe to repeat.
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
      const drafted = await this.monthlyRun.runAllAccounts(now);
      const finalised = await this.invoiceReview.finaliseDueInvoices(now);
      if (drafted.length || finalised.length) {
        this.logger.log(
          `Billing run: ${drafted.length} drafted, ${finalised.length} finalised.`,
        );
      }
    } catch (error) {
      this.logger.error(`Billing run failed: ${String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }
}
