import { Injectable, Logger } from '@nestjs/common';
import * as Stripe from 'stripe';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { PersonalCheckoutService } from '../personalSubscription/personalCheckout.service';
import { StripeService } from '../stripe/stripe.service';
import { toStripeGatewayError } from '../stripe/stripeErrors';
import { invoicePaymentSheetFinalizeKey } from '../stripe/stripeIdempotencyKeys';
import { toInvoiceEventUpdate } from '../webhooks/stripeInvoiceEvents';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import { findInvoice } from './invoices.repository';
import { InvoiceStripeSyncService } from './invoiceStripeSync.service';
import { InvoiceRow } from './types/invoiceRows';

// What the mobile app passes to Stripe's Payment Sheet (initPaymentSheet).
// The app validates it with zod: keep the names exactly as they are.
export interface PaymentSheet {
  publishableKey: string;
  paymentIntentClientSecret: string;
  customerId: string | null;
  // Only ever sent together with customerId.
  customerEphemeralKeySecret: string | null;
  merchantDisplayName: string | null;
}

export const MERCHANT_DISPLAY_NAME = 'FIELD';

// The Payment Sheet for one FIELD invoice. It pays the Stripe invoice's own
// PaymentIntent, never a separate one, so paying it pays the invoice: the
// invoice.paid webhook and the payment checks record it as they always have.
// Calling again while the invoice is open returns the same PaymentIntent.
@Injectable()
export class InvoicePaymentSheetService {
  private readonly logger = new Logger(InvoicePaymentSheetService.name);

  constructor(
    private readonly serviceDatabase: ServiceDatabaseService,
    private readonly billingAccounts: BillingAccountsService,
    private readonly stripe: StripeService,
    private readonly sync: InvoiceStripeSyncService,
    private readonly checkout: PersonalCheckoutService,
  ) {}

  // False without STRIPE_PUBLISHABLE_KEY: callers then keep their existing
  // payment page instead of moving the invoice to Stripe.
  get isAvailable(): boolean {
    return Boolean(this.stripe.publishableKey);
  }

  // Null when nothing is due on the invoice (paid, void or zero due).
  forInvoice = async (invoice: InvoiceRow): Promise<PaymentSheet | null> => {
    const publishableKey = this.stripe.publishableKey;
    if (!publishableKey) {
      this.logger.warn(
        'Payment Sheet requested but STRIPE_PUBLISHABLE_KEY is not set.',
      );
      return null;
    }
    if (invoice.status === 'paid' || invoice.status === 'void') return null;
    try {
      const account = await this.billingAccounts.ensureStripeCustomer(
        await this.billingAccounts.requireAccount(invoice.billing_account_id),
      );
      const customerId = account.stripe_customer_id as string;
      const clientSecret = await this.invoiceClientSecret(invoice, customerId);
      if (!clientSecret) return null;
      const ephemeralKey = await this.stripe.createEphemeralKey(customerId);
      return {
        publishableKey,
        paymentIntentClientSecret: clientSecret,
        customerId: ephemeralKey.secret ? customerId : null,
        customerEphemeralKeySecret: ephemeralKey.secret ?? null,
        merchantDisplayName: MERCHANT_DISPLAY_NAME,
      };
    } catch (error) {
      throw toStripeGatewayError(error);
    }
  };

  // The client secret of the Stripe invoice's PaymentIntent, putting the
  // invoice on Stripe (finalised, card only) first if it isn't yet.
  private invoiceClientSecret = async (
    invoice: InvoiceRow,
    customerId: string,
  ): Promise<string | null> => {
    if (!invoice.stripe_invoice_id) {
      const checkout = await this.checkout.closeCheckout(invoice, customerId);
      if (checkout === 'paid') return null;
    }
    if (
      !invoice.stripe_invoice_id ||
      invoice.status === 'draft' ||
      invoice.status === 'final'
    ) {
      await this.sync.pushInvoice(invoice, { forPaymentSheet: true });
    }
    const stripeInvoiceId =
      invoice.stripe_invoice_id ??
      (await findInvoice(this.serviceDatabase, invoice.id))?.stripe_invoice_id;
    if (!stripeInvoiceId) return null;
    let stripeInvoice =
      await this.stripe.retrieveInvoiceWithConfirmationSecret(stripeInvoiceId);
    if (stripeInvoice.status === 'draft') {
      stripeInvoice = await this.stripe.finalizeInvoiceWithConfirmationSecret(
        stripeInvoiceId,
        invoicePaymentSheetFinalizeKey(invoice.id),
      );
    }
    if (stripeInvoice.status === 'paid') {
      await this.recordPaid(stripeInvoice);
      return null;
    }
    if (stripeInvoice.status !== 'open' || stripeInvoice.amount_due <= 0)
      return null;
    const clientSecret = stripeInvoice.confirmation_secret?.client_secret;
    if (!clientSecret) {
      this.logger.warn(
        `Stripe invoice ${stripeInvoiceId} is open but has no confirmation secret.`,
      );
      return null;
    }
    return clientSecret;
  };

  // Paid on Stripe before its webhook arrived: recorded exactly as
  // invoice.paid would record it.
  private recordPaid = (stripeInvoice: Stripe.Invoice) =>
    this.serviceDatabase.transaction((client) =>
      applyInvoiceEventUpdate(
        client,
        toInvoiceEventUpdate('invoice.paid', stripeInvoice),
      ),
    );
}
