import { Injectable, Logger } from '@nestjs/common';
import * as Stripe from 'stripe';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import {
  invoiceCreateKey,
  invoiceFinalizeKey,
  invoiceItemCreateKey,
  invoicePayKey,
} from '../stripe/stripeIdempotencyKeys';
import * as invoicesRepository from './invoices.repository';
import * as invoiceSyncRepository from './invoiceSync.repository';
import { toInvoiceTotals } from './invoiceAmounts';
import { formatCents } from './formatCents';
import { InvoiceLineRow, InvoiceRow } from './types/invoiceRows';

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

  pushInvoice = async (invoice: InvoiceRow): Promise<void> => {
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
  ): Promise<string> => {
    if (invoice.stripe_invoice_id) return invoice.stripe_invoice_id;
    const [{ PAYMENT_TERMS_DAYS }, chargeAutomatically] = await Promise.all([
      this.billingConfig.loadConfig(),
      this.stripeService.hasDefaultPaymentMethod(customerId),
    ]);
    const stripeInvoice = await this.stripeService.createInvoice(
      {
        customerId,
        currency: invoice.currency,
        fieldInvoiceId: invoice.id,
        daysUntilDue: PAYMENT_TERMS_DAYS,
        chargeAutomatically,
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
