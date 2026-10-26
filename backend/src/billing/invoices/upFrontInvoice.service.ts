import { Injectable, Logger } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';
import { insertRunInvoice } from '../monthlyRun/runInvoices.repository';
import { Subscription } from '../subscriptions/subscriptionTypes';
import { InvoicesService } from './invoices.service';
import { calculateAnnualTermLine } from './upFrontLines';

// Invoices raised at the moment they occur (spec section 9): an annual
// term's up-front payment and assisted onboarding. Same path as the
// monthly run (calculate → draft → finalise → push to Stripe), without
// the review window. If Stripe fails, the draft stays and the hourly
// billing job finalises it later.
@Injectable()
export class UpFrontInvoiceService {
  private readonly logger = new Logger(UpFrontInvoiceService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccounts: BillingAccountsService,
    private readonly priceBooks: PriceBooksService,
    private readonly invoices: InvoicesService,
  ) {}

  // Once per annual term (uq_invoices_account_annual_term). The invoice
  // id, or null when the term needs no up-front invoice or already has one.
  invoiceAnnualTerm = async (
    subscription: Subscription,
    actor: BillingActor | null = null,
  ): Promise<string | null> => {
    if (
      subscription.term !== 'annual' ||
      subscription.committedQty === null ||
      subscription.annualMonthsCharged === null
    )
      return null;
    const book = await this.priceBooks.getPinnedPriceBook(
      subscription.priceBookId,
    );
    const line = calculateAnnualTermLine(
      {
        subscriptionId: subscription.id,
        planCode: subscription.planCode,
        committedQty: subscription.committedQty,
        monthsCharged: subscription.annualMonthsCharged,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      },
      book,
    );
    if (!line || line.amountCents === 0) return null;
    const invoiceId = await this.serviceDatabase.transaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM billing.invoices
         WHERE billing_account_id = $1 AND kind = 'annual'
           AND period_start = $2::date AND status <> 'void'`,
        [subscription.billingAccountId, subscription.currentPeriodStart],
      );
      if (existing.rows.length) return null;
      return this.draft(client, actor, {
        billingAccountId: subscription.billingAccountId,
        kind: 'annual',
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        lines: [line],
        reason: 'annual term invoiced up front',
      });
    });
    if (invoiceId)
      await this.finalise(invoiceId, subscription.billingAccountId);
    return invoiceId;
  };

  // Drafts one up-front invoice inside the caller's transaction (audited).
  draft = async (
    client: Parameters<typeof insertRunInvoice>[0],
    actor: BillingActor | null,
    params: {
      billingAccountId: string;
      kind: 'annual' | 'onboarding';
      periodStart: string | null;
      periodEnd: string | null;
      lines: CalculatedLine[];
      reason: string;
    },
  ): Promise<string> => {
    const totalExGstCents = params.lines.reduce(
      (sum, line) => sum + line.amountCents,
      0,
    );
    const invoiceId = await insertRunInvoice(client, {
      billingAccountId: params.billingAccountId,
      kind: params.kind,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      reviewUntil: null,
      totalExGstCents,
      lines: params.lines,
    });
    await recordBillingAudit(client, actor, {
      action: 'create',
      entityType: 'billing_invoice',
      entityId: invoiceId,
      billingAccountId: params.billingAccountId,
      from: null,
      to: { status: 'draft', kind: params.kind, totalExGstCents },
      reason: params.reason,
      metadata: { lineCount: params.lines.length },
    });
    return invoiceId;
  };

  // Push to Stripe and email the billing contact; a failure is retried by
  // the hourly billing job.
  finalise = async (invoiceId: string, billingAccountId: string) => {
    try {
      const account =
        await this.billingAccounts.requireAccount(billingAccountId);
      await this.invoices.finaliseInvoice(invoiceId, account.billing_email);
    } catch (error) {
      this.logger.warn(
        `Invoice ${invoiceId} saved; Stripe push will be retried: ${String(error)}`,
      );
    }
  };
}
