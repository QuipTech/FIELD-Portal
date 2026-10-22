import { Injectable } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import {
  invoiceCreateKey,
  invoiceFinalizeKey,
  invoiceItemCreateKey,
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
      await this.finalize(invoice.id, stripeInvoiceId);
    } catch (error) {
      throw toStripeGatewayError(error);
    }
  };

  private ensureStripeInvoice = async (
    invoice: InvoiceRow,
    customerId: string,
  ): Promise<string> => {
    if (invoice.stripe_invoice_id) return invoice.stripe_invoice_id;
    const { PAYMENT_TERMS_DAYS } = await this.billingConfig.loadConfig();
    const stripeInvoice = await this.stripeService.createInvoice(
      {
        customerId,
        currency: invoice.currency,
        fieldInvoiceId: invoice.id,
        daysUntilDue: PAYMENT_TERMS_DAYS,
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
  ): Promise<void> => {
    const finalized = await this.stripeService.finalizeInvoice(
      stripeInvoiceId,
      invoiceFinalizeKey(invoiceId),
    );
    await invoiceSyncRepository.markInvoiceSynced(
      this.serviceDatabase,
      invoiceId,
      toInvoiceTotals(finalized),
      finalized.hosted_invoice_url ?? null,
    );
  };
}

// Stripe items carry one amount, so quantity × unit goes in the text.
const describeLine = (line: InvoiceLineRow): string =>
  line.quantity === 1
    ? line.description
    : `${line.description} (${line.quantity} × ${formatCents(Number(line.unit_cents))})`;
