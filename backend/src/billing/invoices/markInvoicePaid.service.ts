import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as Stripe from 'stripe';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { invoicePaidOutOfBandKey } from '../stripe/stripeIdempotencyKeys';
import { toInvoiceEventUpdate } from '../webhooks/stripeInvoiceEvents';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import * as invoicesRepository from './invoices.repository';
import { InvoicesService } from './invoices.service';
import { InvoiceDetail } from './types/invoiceResponse';

const NOT_FOUND_MESSAGE = 'Invoice not found.';
const NOT_UNPAID_MESSAGE =
  'Only an unpaid invoice that has been sent through Stripe can be marked as paid.';
const CARD_CHARGED_MESSAGE =
  'This invoice is charged to a saved card, so its payment comes through Stripe. It cannot be marked as paid by hand.';
const PERSONAL_MESSAGE = 'Personal TECH invoices are paid in FIELD by card.';

export type PaymentMethod = 'bank_transfer' | 'cheque' | 'cash' | 'other';

export interface MarkPaidInput {
  paidOn: string;
  method: PaymentMethod;
  reference: string | null;
}

// A platform administrator records a payment that arrived outside Stripe
// (a 30-day account paying by bank transfer): Stripe's invoice is marked
// paid out of band (nothing is charged) and FIELD's invoice becomes paid,
// with the date, method and reference, audited in the same transaction.
// The invoice.paid webhook that follows changes nothing more.
@Injectable()
export class MarkInvoicePaidService {
  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly stripeService: StripeService,
    private readonly invoices: InvoicesService,
  ) {}

  markPaid = async (
    actor: AuthenticatedUser,
    invoiceId: string,
    input: MarkPaidInput,
  ): Promise<InvoiceDetail> => {
    const invoice = await invoicesRepository.findInvoice(
      this.serviceDatabase,
      invoiceId,
    );
    if (!invoice) throw new NotFoundException(NOT_FOUND_MESSAGE);
    if (invoice.kind === 'personal')
      throw new ConflictException(PERSONAL_MESSAGE);
    if (invoice.collection_method === 'charge_automatically')
      throw new ConflictException(CARD_CHARGED_MESSAGE);
    if (
      !invoice.stripe_invoice_id ||
      !['synced', 'payment_failed'].includes(invoice.status)
    )
      throw new ConflictException(NOT_UNPAID_MESSAGE);

    const stripeInvoice = await this.payOnStripe(
      invoice.id,
      invoice.stripe_invoice_id,
    );
    await this.serviceDatabase.transaction(async (client) => {
      await applyInvoiceEventUpdate(
        client,
        toInvoiceEventUpdate('invoice.paid', stripeInvoice),
      );
      await client.query(
        `UPDATE billing.invoices SET
           marked_paid_on = $2, marked_paid_method = $3, marked_paid_reference = $4,
           marked_paid_by = $5, marked_paid_at = now(), status = 'paid',
           amount_paid_cents = GREATEST(amount_paid_cents, coalesce(total_cents, total_ex_gst_cents)),
           updated_at = now()
         WHERE id = $1`,
        [invoice.id, input.paidOn, input.method, input.reference, actor.userId],
      );
      await recordBillingAudit(client, actor, {
        action: 'update',
        entityType: 'billing_invoice',
        entityId: invoice.id,
        billingAccountId: invoice.billing_account_id,
        from: { status: invoice.status },
        to: { status: 'paid', paidOutOfBand: true, ...input },
        reason: `marked paid (${input.method})`,
      });
    });
    return this.invoices.getInvoice(invoice.id);
  };

  // Marks it paid on Stripe. If Stripe already has it paid (a retry, or
  // paid there meanwhile), that's fine too.
  private payOnStripe = async (
    invoiceId: string,
    stripeInvoiceId: string,
  ): Promise<Stripe.Invoice> => {
    try {
      return await this.stripeService.payInvoiceOutOfBand(
        stripeInvoiceId,
        invoicePaidOutOfBandKey(invoiceId),
      );
    } catch (error) {
      const current = await this.stripeService
        .retrieveInvoice(stripeInvoiceId)
        .catch(() => null);
      if (current?.status === 'paid') return current;
      throw toStripeGatewayError(error);
    }
  };
}
