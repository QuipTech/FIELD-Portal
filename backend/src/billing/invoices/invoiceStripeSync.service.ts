import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as Stripe from 'stripe';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { findAccountTerms } from '../accountTerms/accountTerms.repository';
import {
  usesAccountTerms,
  ZOHO_BILLED_MESSAGE,
} from '../accountTerms/accountTermsTypes';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import {
  invoiceCreateKey,
  invoiceFinalizeKey,
  invoiceItemCreateKey,
  invoicePayKey,
} from '../stripe/stripeIdempotencyKeys';
import { toInvoiceEventUpdate } from '../webhooks/stripeInvoiceEvents';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import * as invoicesRepository from './invoices.repository';
import * as invoiceSyncRepository from './invoiceSync.repository';
import { buildInvoicePresentation } from './accountInvoiceTerms';
import { toInvoiceTotals } from './invoiceAmounts';
import { formatCents } from './formatCents';
import { InvoiceLineRow, InvoiceRow } from './types/invoiceRows';

export interface PushInvoiceOptions {
  // The payer pays it in the mobile Payment Sheet: card only (no delayed
  // methods such as BECS debit), and never charged to a saved card here.
  // Applies when the Stripe invoice is first created.
  forPaymentSheet?: boolean;
}

// Pushes one FIELD invoice to Stripe: an empty Stripe Invoice, one Invoice
// Item per line, then finalise. Every step is idempotent twice over — a
// Stripe idempotency key, and a saved Stripe id that makes a retry skip
// the step — so re-running a half-finished push never duplicates anything.
@Injectable()
export class InvoiceStripeSyncService {
  private readonly logger = new Logger(InvoiceStripeSyncService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccountsService: BillingAccountsService,
    private readonly stripeService: StripeService,
    private readonly billingConfig: BillingConfigService,
  ) {}

  pushInvoice = async (
    invoice: InvoiceRow,
    options: PushInvoiceOptions = {},
  ): Promise<void> => {
    await this.assertNotZohoBilled(invoice);
    try {
      const account = await this.billingAccountsService.ensureStripeCustomer(
        await this.billingAccountsService.requireAccount(
          invoice.billing_account_id,
        ),
      );
      const customerId = account.stripe_customer_id as string;
      await invoiceSyncRepository.lockInvoiceLines(
        this.serviceDatabase,
        invoice.id,
      );
      const stripeInvoiceId = await this.ensureStripeInvoice(
        invoice,
        customerId,
        options,
      );
      const lines = await invoicesRepository.listInvoiceLines(
        this.serviceDatabase,
        invoice.id,
      );
      for (const line of lines) {
        await this.ensureInvoiceItem(line, {
          customerId,
          stripeInvoiceId,
          currency: invoice.currency,
        });
      }
      const finalized = await this.finalize(invoice.id, stripeInvoiceId);
      if (finalized.collection_method === 'charge_automatically')
        await this.chargeNow(invoice.id, finalized);
    } catch (error) {
      throw toStripeGatewayError(error);
    }
  };

  // A 30-day account is invoiced in Zoho: a new invoice for it must never
  // reach Stripe (not even a Stripe customer). One already on Stripe from
  // before the account moved keeps syncing.
  private assertNotZohoBilled = async (invoice: InvoiceRow): Promise<void> => {
    if (invoice.stripe_invoice_id) return;
    const terms = await findAccountTerms(
      this.serviceDatabase,
      invoice.billing_account_id,
    );
    if (terms && usesAccountTerms(terms))
      throw new ConflictException(ZOHO_BILLED_MESSAGE);
  };

  // Asks Stripe whether an invoice has been paid, for a customer back from
  // paying before the webhook arrives. Applied just as invoice.paid would be,
  // so the webhook repeating it changes nothing. True if it's now paid.
  refreshPaidStatus = async (invoice: InvoiceRow): Promise<boolean> => {
    if (!invoice.stripe_invoice_id || invoice.status === 'paid') return false;
    const stripeInvoice = await this.stripeService.retrieveInvoice(
      invoice.stripe_invoice_id,
    );
    if (stripeInvoice.status !== 'paid') return false;
    await this.serviceDatabase.transaction((client) =>
      applyInvoiceEventUpdate(
        client,
        toInvoiceEventUpdate('invoice.paid', stripeInvoice),
      ),
    );
    return true;
  };

  // Card or direct debit on file: charge it straight away. A decline is
  // not an error here; invoice.payment_failed records it and the overdue
  // process follows it up.
  private chargeNow = async (
    invoiceId: string,
    finalized: Stripe.Invoice,
  ): Promise<void> => {
    if (finalized.status !== 'open' || !finalized.id) return;
    try {
      await this.stripeService.payInvoice(
        finalized.id,
        invoicePayKey(invoiceId),
      );
    } catch (error) {
      this.logger.warn(
        `Automatic charge for invoice ${invoiceId} failed: ${String(error)}`,
      );
    }
  };

  private ensureStripeInvoice = async (
    invoice: InvoiceRow,
    customerId: string,
    { forPaymentSheet = false }: PushInvoiceOptions,
  ): Promise<string> => {
    if (invoice.stripe_invoice_id) return invoice.stripe_invoice_id;
    const [config, terms] = await Promise.all([
      this.billingConfig.loadConfig(),
      findAccountTerms(this.serviceDatabase, invoice.billing_account_id),
    ]);
    // An invoice the customer chose to pay by bank transfer is sent with the
    // bank details and never charged to a card. (An approved 30-day account
    // never gets here: assertNotZohoBilled.)
    const presentation = buildInvoicePresentation({
      invoiceId: invoice.id,
      accountName: terms?.name ?? invoice.billing_account_name,
      usesAccountTerms:
        invoice.pay_by_bank_transfer ||
        (terms ? usesAccountTerms(terms) : false),
      termsDays: terms?.terms_days ?? config.PAYMENT_TERMS_DAYS,
      poRequired: terms?.po_required ?? false,
      invoicePoNumber: invoice.po_number ?? null,
      defaultPoNumber: terms?.default_po_number ?? null,
      bank: config,
    });
    // The Payment Sheet pays the invoice itself, so it's never charged
    // to a saved card.
    const chargeAutomatically =
      !forPaymentSheet &&
      presentation.accountTermsDays === null &&
      (await this.stripeService.hasDefaultPaymentMethod(customerId));
    const stripeInvoice = await this.stripeService.createInvoice(
      {
        customerId,
        currency: invoice.currency,
        fieldInvoiceId: invoice.id,
        daysUntilDue:
          presentation.accountTermsDays ?? config.PAYMENT_TERMS_DAYS,
        chargeAutomatically,
        ...(forPaymentSheet && { paymentMethodTypes: ['card' as const] }),
        footer: presentation.footer,
        customFields: presentation.customFields,
      },
      invoiceCreateKey(invoice.id),
    );
    await invoiceSyncRepository.saveStripeInvoiceId(
      this.serviceDatabase,
      invoice.id,
      stripeInvoice.id,
    );
    return stripeInvoice.id;
  };

  private ensureInvoiceItem = async (
    line: InvoiceLineRow,
    target: { customerId: string; stripeInvoiceId: string; currency: string },
  ): Promise<void> => {
    if (line.stripe_invoice_item_id) return;
    const item = await this.stripeService.createInvoiceItem(
      {
        ...target,
        amountCents: Number(line.amount_cents),
        description: describeLine(line),
        fieldInvoiceLineId: line.id,
      },
      invoiceItemCreateKey(line.id),
    );
    await invoiceSyncRepository.saveStripeInvoiceItemId(
      this.serviceDatabase,
      line.id,
      item.id,
    );
  };

  private finalize = async (
    invoiceId: string,
    stripeInvoiceId: string,
  ): Promise<Stripe.Invoice> => {
    const finalized = await this.stripeService.finalizeInvoice(
      stripeInvoiceId,
      invoiceFinalizeKey(invoiceId),
    );
    await invoiceSyncRepository.markInvoiceSynced(
      this.serviceDatabase,
      invoiceId,
      toInvoiceTotals(finalized),
      finalized.hosted_invoice_url ?? null,
      toDueDay(finalized),
      finalized.collection_method ?? null,
    );
    return finalized;
  };
}

// Stripe's due date (send_invoice), or the day it was finalised when the
// card on file is charged at once. UTC calendar day.
const toDueDay = (invoice: Stripe.Invoice): string => {
  const seconds =
    invoice.due_date ??
    invoice.status_transitions?.finalized_at ??
    Math.floor(Date.now() / 1000);
  return new Date(seconds * 1000).toISOString().slice(0, 10);
};

// Stripe items carry one amount, so quantity × unit goes in the text.
const describeLine = (line: InvoiceLineRow): string =>
  line.quantity === 1
    ? line.description
    : `${line.description} (${line.quantity} × ${formatCents(Number(line.unit_cents))})`;
