import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PersonalCheckoutService } from '../personalSubscription/personalCheckout.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { findInvoice } from './invoices.repository';
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
    private readonly checkout: PersonalCheckoutService,
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
      kind: 'annual' | 'onboarding' | 'machine_final';
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

  // Paying an invoice on the spot (a machine's final charge) with Stripe
  // Checkout instead of pushing it as a Stripe invoice: Checkout shows the
  // total, asks for the billing address (so Stripe Tax can add GST) and
  // creates the paid Stripe invoice itself. The Checkout URL, or null when
  // it's already paid. A failure reaches the payer; the invoice stays saved.
  openCheckout = async (
    invoiceId: string,
    options: { returnPage: string; keyScope: string; description: string },
  ): Promise<string | null> => {
    try {
      const invoice = await this.requireInvoiceRow(invoiceId);
      const account = await this.billingAccounts.ensureStripeCustomer(
        await this.billingAccounts.requireAccount(invoice.billing_account_id),
      );
      // A Stripe invoice from an earlier, failed push was never finalised:
      // drop the link so Checkout's paid invoice is the one matched to ours.
      if (invoice.stripe_invoice_id && !invoice.hosted_invoice_url) {
        await this.serviceDatabase.query(
          `UPDATE billing.invoices SET stripe_invoice_id = NULL
           WHERE id = $1 AND hosted_invoice_url IS NULL`,
          [invoice.id],
        );
        invoice.stripe_invoice_id = null;
      }
      return await this.checkout.openCheckoutAt(
        invoice,
        account.stripe_customer_id as string,
        { ...options, collectBillingAddress: true },
      );
    } catch (error) {
      throw toStripeGatewayError(error);
    }
  };

  // True if a Checkout payment was found for any of them and recorded, for a
  // payer back from Checkout before its webhook. A failure only means the
  // webhook has to bring the news instead.
  confirmCheckouts = async (
    invoiceIds: string[],
    billingAccountId: string,
  ): Promise<boolean> => {
    if (invoiceIds.length === 0) return false;
    let isAnyPaid = false;
    try {
      const account =
        await this.billingAccounts.requireAccount(billingAccountId);
      if (!account.stripe_customer_id) return false;
      for (const invoiceId of invoiceIds) {
        const invoice = await this.requireInvoiceRow(invoiceId);
        if (
          await this.checkout.confirmPayment(
            invoice,
            account.stripe_customer_id,
          )
        )
          isAnyPaid = true;
      }
    } catch (error) {
      this.logger.warn(
        `Couldn't check Stripe Checkout for invoices ${invoiceIds.join(', ')}: ${String(error)}`,
      );
    }
    return isAnyPaid;
  };

  private requireInvoiceRow = async (invoiceId: string) => {
    const invoice = await findInvoice(this.serviceDatabase, invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  };

  // True if Stripe says any of them has been paid. A failure only means the
  // webhook has to bring the news instead.
  refreshPaid = async (invoiceIds: string[]): Promise<boolean> => {
    let isAnyPaid = false;
    for (const invoiceId of invoiceIds) {
      try {
        if (await this.invoices.refreshPaidStatus(invoiceId)) isAnyPaid = true;
      } catch (error) {
        this.logger.warn(
          `Couldn't read invoice ${invoiceId} from Stripe: ${String(error)}`,
        );
      }
    }
    return isAnyPaid;
  };
}
