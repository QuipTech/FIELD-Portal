import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as Stripe from 'stripe';
import {
  assertStripeKeyAllowed,
  readStripeSettings,
  StripeSettings,
} from './stripeConfig';

const NOT_CONFIGURED_MESSAGE = 'Billing is not configured (STRIPE_SECRET_KEY).';
const WEBHOOK_NOT_CONFIGURED_MESSAGE =
  'Billing webhooks are not configured (STRIPE_WEBHOOK_SECRET).';

export interface CreateCustomerInput {
  name: string;
  email: string;
  abn: string | null;
  billingAccountId: string;
}

export interface UpdateCustomerInput {
  name: string;
  email: string;
}

export interface CreateInvoiceInput {
  customerId: string;
  currency: string;
  fieldInvoiceId: string;
  // PAYMENT_TERMS_DAYS from billing config.
  daysUntilDue: number;
  // The customer has a default card or direct debit: Stripe charges it
  // (spec section 9). Otherwise Stripe emails the invoice with the terms.
  chargeAutomatically: boolean;
}

export interface CreateCheckoutInput {
  customerId: string;
  currency: string;
  amountCents: number;
  description: string;
  fieldInvoiceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateInvoiceItemInput {
  customerId: string;
  stripeInvoiceId: string;
  currency: string;
  amountCents: number;
  description: string;
  fieldInvoiceLineId: string;
}

// The only Stripe SDK client in the codebase; every Stripe call goes
// through here. Writes take an idempotency key (stripeIdempotencyKeys.ts).
// Only src/billing may import 'stripe' (ESLint + stripeImportBoundary.spec).
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly settings: StripeSettings;
  private client: Stripe | null = null;

  constructor(configService: ConfigService) {
    this.settings = readStripeSettings(configService);
    assertStripeKeyAllowed(
      this.settings.secretKey,
      configService.get<string>('NODE_ENV'),
    );
    this.logger.log(
      `Stripe mode: ${this.settings.mode}; tax ${this.settings.isTaxEnabled ? 'on' : 'off'}`,
    );
  }

  createCustomer = (input: CreateCustomerInput, idempotencyKey: string) =>
    this.require().customers.create(
      {
        name: input.name,
        email: input.email,
        metadata: { fieldBillingAccountId: input.billingAccountId },
        ...(input.abn && {
          tax_id_data: [{ type: 'au_abn', value: input.abn }],
        }),
      },
      { idempotencyKey },
    );

  // Keeps the name and email Stripe prints on invoices in step with FIELD.
  updateCustomer = (
    customerId: string,
    input: UpdateCustomerInput,
    idempotencyKey: string,
  ) =>
    this.require().customers.update(
      customerId,
      { name: input.name, email: input.email },
      { idempotencyKey },
    );

  updateBillingAddress = (
    customerId: string,
    address: { line1: string; city: string; state: string; postalCode: string },
  ) => {
    const billingAddress = {
      line1: address.line1,
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: 'AU',
    };
    const hash = createHash('sha256')
      .update(JSON.stringify(billingAddress))
      .digest('hex');
    return this.require().customers.update(
      customerId,
      { address: billingAddress },
      { idempotencyKey: `personal-address:${customerId}:${hash}` },
    );
  };

  // Created empty (pending items excluded) so it only ever holds the items
  // attached to it explicitly.
  createInvoice = (input: CreateInvoiceInput, idempotencyKey: string) =>
    this.require().invoices.create(
      {
        customer: input.customerId,
        currency: input.currency.toLowerCase(),
        ...(input.chargeAutomatically
          ? { collection_method: 'charge_automatically' as const }
          : {
              collection_method: 'send_invoice' as const,
              days_until_due: input.daysUntilDue,
            }),
        pending_invoice_items_behavior: 'exclude',
        auto_advance: false,
        automatic_tax: { enabled: this.settings.isTaxEnabled },
        metadata: { fieldInvoiceId: input.fieldInvoiceId },
      },
      { idempotencyKey },
    );

  createInvoiceItem = (input: CreateInvoiceItemInput, idempotencyKey: string) =>
    this.require().invoiceItems.create(
      {
        customer: input.customerId,
        invoice: input.stripeInvoiceId,
        currency: input.currency.toLowerCase(),
        amount: input.amountCents,
        description: input.description,
        tax_behavior: 'exclusive',
        metadata: { fieldInvoiceLineId: input.fieldInvoiceLineId },
      },
      { idempotencyKey },
    );

  finalizeInvoice = (stripeInvoiceId: string, idempotencyKey: string) =>
    this.require().invoices.finalizeInvoice(
      stripeInvoiceId,
      { auto_advance: false },
      { idempotencyKey },
    );

  // Charges an automatically collected invoice now. A declined payment
  // throws; Stripe's invoice.payment_failed webhook records it.
  payInvoice = (stripeInvoiceId: string, idempotencyKey: string) =>
    this.require().invoices.pay(stripeInvoiceId, {}, { idempotencyKey });

  // True when the customer saved a card or direct debit for invoices (in
  // the Customer Portal), so invoices can be charged automatically.
  hasDefaultPaymentMethod = async (customerId: string): Promise<boolean> => {
    const customer = await this.require().customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) return false;
    if (!('invoice_settings' in customer)) return false;
    return Boolean(
      customer.invoice_settings?.default_payment_method ??
      customer.default_source,
    );
  };

  // A credit note for part or all of a finalised invoice: amountCents is
  // the GST-inclusive amount given back (credited to the balance, or
  // refunded if the invoice was paid).
  createCreditNote = (
    input: { stripeInvoiceId: string; amountCents: number; memo: string },
    idempotencyKey: string,
  ) =>
    this.require().creditNotes.create(
      {
        invoice: input.stripeInvoiceId,
        amount: input.amountCents,
        memo: input.memo,
      },
      { idempotencyKey },
    );

  // A Customer Portal session where the customer manages payment methods
  // and sees their invoices. Its URL is single-use and short-lived.
  createPortalSession = (stripeCustomerId: string, returnUrl: string) =>
    this.require().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

  // Stripe's PDF of a finalised invoice; null while Stripe has none.
  getInvoicePdfUrl = async (stripeInvoiceId: string): Promise<string | null> =>
    (await this.require().invoices.retrieve(stripeInvoiceId)).invoice_pdf ??
    null;

  // A Checkout page for one FIELD invoice. Stripe sends the payer back to
  // successUrl afterwards and creates a paid invoice tagged with
  // fieldInvoiceId, which the invoice webhooks then match to ours.
  createCheckoutSession = (
    input: CreateCheckoutInput,
    idempotencyKey: string,
  ) =>
    this.require().checkout.sessions.create(
      {
        mode: 'payment',
        customer: input.customerId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.amountCents,
              tax_behavior: 'exclusive',
              product_data: { name: input.description },
            },
          },
        ],
        automatic_tax: { enabled: this.settings.isTaxEnabled },
        invoice_creation: {
          enabled: true,
          invoice_data: { metadata: { fieldInvoiceId: input.fieldInvoiceId } },
        },
        metadata: { fieldInvoiceId: input.fieldInvoiceId },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      },
      { idempotencyKey },
    );

  // The customer's recent Checkout sessions for one FIELD invoice, newest
  // first, so an open one is reused and a completed one is never paid twice.
  listCheckoutSessions = async (customerId: string, fieldInvoiceId: string) =>
    (
      await this.require().checkout.sessions.list({
        customer: customerId,
        limit: 20,
      })
    ).data.filter(
      (session) => session.metadata?.fieldInvoiceId === fieldInvoiceId,
    );

  // Stripe's current copy of an invoice, for confirming a payment whose
  // webhook never arrived.
  retrieveInvoice = (stripeInvoiceId: string) =>
    this.require().invoices.retrieve(stripeInvoiceId);

  // A Charge no longer names its invoice (API 2025+); the invoice payment
  // for its PaymentIntent does.
  findInvoiceIdForPaymentIntent = async (
    paymentIntentId: string,
  ): Promise<string | undefined> => {
    const payments = await this.require().invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: paymentIntentId },
      limit: 1,
    });
    const invoice = payments.data[0]?.invoice;
    if (!invoice) return undefined;
    return typeof invoice === 'string' ? invoice : invoice.id;
  };

  // Verifies the Stripe-Signature header against the raw request body;
  // throws on a bad or stale signature. Makes no API call.
  constructWebhookEvent = (
    rawBody: Buffer,
    signature: string,
  ): Stripe.Event => {
    if (!this.settings.webhookSecret)
      throw new ServiceUnavailableException(WEBHOOK_NOT_CONFIGURED_MESSAGE);
    return this.require().webhooks.constructEvent(
      rawBody,
      signature,
      this.settings.webhookSecret,
    );
  };

  private require = (): Stripe => {
    if (!this.settings.secretKey)
      throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    this.client ??= new Stripe(this.settings.secretKey);
    return this.client;
  };
}
