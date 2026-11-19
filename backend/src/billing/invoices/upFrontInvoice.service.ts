import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PersonalCheckoutService } from '../personalSubscription/personalCheckout.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { findInvoice } from './invoices.repository';
import { findAccountTerms } from '../accountTerms/accountTerms.repository';
import {
  usesAccountTerms,
  ZOHO_BILLED_MESSAGE,
} from '../accountTerms/accountTermsTypes';
import { StatementsService } from '../statements/statements.service';
import { hasStatementLine } from '../statements/statements.repository';
import { firstDayOfMonth } from '../billingCalendar/billingDay';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingActor, recordBillingAudit } from '../billingAudit/billingAudit';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';
import { insertRunInvoice } from '../monthlyRun/runInvoices.repository';
import { Subscription } from '../subscriptions/subscriptionTypes';
import { InvoicesService } from './invoices.service';
import { calculateAnnualTermLine } from './upFrontLines';
import {
  InvoicePaymentSheetService,
  PaymentSheet,
} from './invoicePaymentSheet.service';
import { StripeService } from '../stripe/stripe.service';

// Why an invoice can't be paid in the Payment Sheet here: the caller then
// opens Checkout as before.
export const PAYMENT_SHEET_UNAVAILABLE = 'unavailable';

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
    private readonly paymentSheets: InvoicePaymentSheetService,
    private readonly stripe: StripeService,
    private readonly statements: StatementsService,
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
      // A 30-day account: the term goes on its statement, once.
      if (
        await this.statements.isZohoBilled(
          subscription.billingAccountId,
          client,
        )
      ) {
        const isCharged = await hasStatementLine(
          client,
          subscription.billingAccountId,
          line.lineType,
          {
            subscriptionId: subscription.id,
            periodStart: subscription.currentPeriodStart,
          },
        );
        if (!isCharged)
          await this.statements.addCharges(client, actor, {
            billingAccountId: subscription.billingAccountId,
            periodStart: firstDayOfMonth(subscription.currentPeriodStart),
            lines: [line],
            reason: 'annual term on the 30-day account statement',
          });
        return null;
      }
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
      await this.assertCardBilled(invoice);
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

  // Paying an invoice (a machine's final charge) by bank transfer instead:
  // open Checkout sessions are closed so it can't be paid twice, and it's
  // flagged and sent through Stripe with the bank details, never charged to
  // a card. A platform administrator marks it paid once the money arrives.
  // 'paid' when Checkout had already taken the payment (now recorded).
  sendForBankTransfer = async (invoiceId: string): Promise<'paid' | 'sent'> => {
    try {
      const invoice = await this.requireInvoiceRow(invoiceId);
      if (invoice.status === 'paid') return 'paid';
      await this.assertCardBilled(invoice);
      const account = await this.billingAccounts.ensureStripeCustomer(
        await this.billingAccounts.requireAccount(invoice.billing_account_id),
      );
      if (!invoice.hosted_invoice_url) {
        const checkout = await this.checkout.closeCheckout(
          invoice,
          account.stripe_customer_id as string,
        );
        if (checkout === 'paid') return 'paid';
      }
      // A Stripe invoice from an earlier, failed push was never finalised:
      // drop it so the new one carries the bank details.
      await this.serviceDatabase.query(
        `UPDATE billing.invoices SET pay_by_bank_transfer = true,
           stripe_invoice_id = CASE WHEN hosted_invoice_url IS NULL THEN NULL ELSE stripe_invoice_id END,
           updated_at = now()
         WHERE id = $1`,
        [invoice.id],
      );
      if (!invoice.hosted_invoice_url) {
        await this.invoices.finaliseInvoice(invoice.id, account.billing_email);
      }
      return 'sent';
    } catch (error) {
      throw toStripeGatewayError(error);
    }
  };

  // Paying an invoice on the spot (a machine's final charge) in the mobile
  // Payment Sheet instead of Checkout: the invoice becomes a card-only Stripe
  // Invoice and the sheet pays its own PaymentIntent. Open Checkout sessions
  // for it are expired first, so it can be paid only once. Null when nothing
  // is left to pay (a payment already taken is recorded).
  // PAYMENT_SHEET_UNAVAILABLE without a publishable key, or while Stripe Tax
  // has no address for the customer: Checkout asks for one, a Stripe
  // Invoice can't, so the caller opens Checkout instead.
  openPaymentSheet = async (
    invoiceId: string,
  ): Promise<PaymentSheet | null | typeof PAYMENT_SHEET_UNAVAILABLE> => {
    if (!this.paymentSheets.isAvailable) {
      this.logger.warn(
        `Final charge ${invoiceId}: no Payment Sheet, STRIPE_PUBLISHABLE_KEY is not set. Using Checkout.`,
      );
      return PAYMENT_SHEET_UNAVAILABLE;
    }
    try {
      const invoice = await this.requireInvoiceRow(invoiceId);
      await this.assertCardBilled(invoice);
      // Not finalised on Stripe yet, so GST is still to be worked out.
      if (!invoice.hosted_invoice_url) {
        const account = await this.billingAccounts.ensureStripeCustomer(
          await this.billingAccounts.requireAccount(invoice.billing_account_id),
        );
        const canTax = await this.stripe.canTaxCustomer(
          account.stripe_customer_id as string,
        );
        if (!canTax) {
          this.logger.warn(
            `Final charge ${invoiceId}: no Payment Sheet, Stripe Tax has no address for customer ${account.stripe_customer_id}. Using Checkout, which asks for one.`,
          );
          return PAYMENT_SHEET_UNAVAILABLE;
        }
      }
      const paymentSheet = await this.paymentSheets.forInvoice(invoice);
      this.logger.log(
        paymentSheet
          ? `Final charge ${invoiceId}: Payment Sheet for Stripe invoice ${invoice.stripe_invoice_id ?? '(new)'}.`
          : `Final charge ${invoiceId}: no Payment Sheet, nothing left to pay on Stripe.`,
      );
      return paymentSheet;
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

  // A 30-day account is invoiced in Zoho: an up-front charge (assisted
  // onboarding) goes on its statement for the month instead of a Stripe
  // invoice. The statement's id, or null for a card client, who gets an
  // invoice as before.
  chargeOnStatement = async (
    client: Parameters<typeof insertRunInvoice>[0],
    actor: BillingActor | null,
    params: {
      billingAccountId: string;
      periodStart: string;
      lines: CalculatedLine[];
      reason: string;
    },
  ): Promise<string | null> => {
    if (!(await this.statements.isZohoBilled(params.billingAccountId, client)))
      return null;
    return this.statements.addCharges(client, actor, {
      ...params,
      periodStart: firstDayOfMonth(params.periodStart),
    });
  };

  // Paying online is for card clients; a 30-day account is invoiced in Zoho.
  private assertCardBilled = async (invoice: {
    billing_account_id: string;
    stripe_invoice_id: string | null;
  }) => {
    if (invoice.stripe_invoice_id) return;
    const terms = await findAccountTerms(
      this.serviceDatabase,
      invoice.billing_account_id,
    );
    if (terms && usesAccountTerms(terms))
      throw new ConflictException(ZOHO_BILLED_MESSAGE);
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
