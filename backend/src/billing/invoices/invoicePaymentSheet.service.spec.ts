import { BadGatewayException } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { PersonalCheckoutService } from '../personalSubscription/personalCheckout.service';
import { StripeService } from '../stripe/stripe.service';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import { findInvoice } from './invoices.repository';
import { InvoicePaymentSheetService } from './invoicePaymentSheet.service';
import { InvoiceStripeSyncService } from './invoiceStripeSync.service';
import { InvoiceRow } from './types/invoiceRows';

jest.mock('./invoices.repository', () => ({ findInvoice: jest.fn() }));
jest.mock('../webhooks/stripeWebhookEvents.repository', () => ({
  applyInvoiceEventUpdate: jest.fn().mockResolvedValue(true),
}));

const PUBLISHABLE_KEY = 'pk_test_field';
const FIELD_INVOICE_ID = '46eab22d-9761-42a9-87ae-a0b15f91ed11';
// Stripe's confirmation secret is the client secret of the invoice's own
// PaymentIntent: pi_<id>_secret_<secret>.
const INVOICE_PI_SECRET = 'pi_invoice_a_secret_abc';

const onStripe = {
  id: FIELD_INVOICE_ID,
  billing_account_id: 'account-a',
  status: 'synced',
  stripe_invoice_id: 'in_a',
  hosted_invoice_url: 'https://invoice.stripe.com/i/a',
} as InvoiceRow;
const notOnStripe = {
  ...onStripe,
  status: 'draft',
  stripe_invoice_id: null,
  hosted_invoice_url: null,
} as InvoiceRow;

const stripeInvoice = (fields: Record<string, unknown> = {}) => ({
  id: 'in_a',
  status: 'open',
  amount_due: 5390,
  amount_paid: 0,
  total: 5390,
  total_excluding_tax: 4900,
  metadata: { fieldInvoiceId: FIELD_INVOICE_ID },
  hosted_invoice_url: 'https://invoice.stripe.com/i/a',
  confirmation_secret: {
    client_secret: INVOICE_PI_SECRET,
    type: 'payment_intent',
  },
  ...fields,
});

const setup = ({ withPublishableKey = true } = {}) => {
  const publishableKey = withPublishableKey ? PUBLISHABLE_KEY : undefined;
  const client = {};
  const database = {
    transaction: async (work: (input: typeof client) => unknown) =>
      work(client),
  };
  let ephemeralCount = 0;
  // Only the Stripe calls the Payment Sheet may make: there is no way to
  // create a separate PaymentIntent here.
  const stripe = {
    publishableKey,
    retrieveInvoiceWithConfirmationSecret: jest
      .fn()
      .mockResolvedValue(stripeInvoice()),
    finalizeInvoiceWithConfirmationSecret: jest
      .fn()
      .mockResolvedValue(stripeInvoice()),
    createEphemeralKey: jest.fn(async () => ({
      id: `ephkey_${++ephemeralCount}`,
      secret: `ek_test_${ephemeralCount}`,
    })),
  };
  const accounts = {
    requireAccount: jest.fn().mockResolvedValue({ id: 'account-a' }),
    ensureStripeCustomer: jest
      .fn()
      .mockResolvedValue({ stripe_customer_id: 'cus_a' }),
  };
  const sync = { pushInvoice: jest.fn().mockResolvedValue(undefined) };
  const checkout = { closeCheckout: jest.fn().mockResolvedValue('closed') };
  jest.mocked(findInvoice).mockResolvedValue(onStripe);
  const service = new InvoicePaymentSheetService(
    database as unknown as ServiceDatabaseService,
    accounts as unknown as BillingAccountsService,
    stripe as unknown as StripeService,
    sync as unknown as InvoiceStripeSyncService,
    checkout as unknown as PersonalCheckoutService,
  );
  return { service, stripe, sync, checkout, client };
};

beforeEach(() => jest.clearAllMocks());

describe('InvoicePaymentSheetService', () => {
  it("returns the open invoice's own PaymentIntent secret, with the customer and a fresh ephemeral key", async () => {
    const { service, stripe, sync } = setup();
    expect(await service.forInvoice(onStripe)).toEqual({
      publishableKey: PUBLISHABLE_KEY,
      paymentIntentClientSecret: INVOICE_PI_SECRET,
      customerId: 'cus_a',
      customerEphemeralKeySecret: 'ek_test_1',
      merchantDisplayName: 'FIELD',
    });
    expect(stripe.retrieveInvoiceWithConfirmationSecret).toHaveBeenCalledWith(
      'in_a',
    );
    expect(stripe.createEphemeralKey).toHaveBeenCalledWith('cus_a');
    expect(sync.pushInvoice).not.toHaveBeenCalled();
  });

  it('puts an invoice not yet on Stripe there first: closes Checkout, pushes card-only, finalises', async () => {
    const { service, stripe, sync, checkout } = setup();
    expect(await service.forInvoice(notOnStripe)).toMatchObject({
      paymentIntentClientSecret: INVOICE_PI_SECRET,
    });
    expect(checkout.closeCheckout).toHaveBeenCalledWith(notOnStripe, 'cus_a');
    expect(sync.pushInvoice).toHaveBeenCalledWith(notOnStripe, {
      forPaymentSheet: true,
    });
    // The Stripe invoice id saved by the push.
    expect(findInvoice).toHaveBeenCalledWith(
      expect.anything(),
      FIELD_INVOICE_ID,
    );
    expect(stripe.retrieveInvoiceWithConfirmationSecret).toHaveBeenCalledWith(
      'in_a',
    );
    expect(checkout.closeCheckout.mock.invocationCallOrder[0]).toBeLessThan(
      sync.pushInvoice.mock.invocationCallOrder[0],
    );
  });

  it('finalises a Stripe invoice that is still a draft, then returns its secret', async () => {
    const { service, stripe } = setup();
    stripe.retrieveInvoiceWithConfirmationSecret.mockResolvedValue(
      stripeInvoice({ status: 'draft', confirmation_secret: null }),
    );
    expect(await service.forInvoice(onStripe)).toMatchObject({
      paymentIntentClientSecret: INVOICE_PI_SECRET,
    });
    expect(stripe.finalizeInvoiceWithConfirmationSecret).toHaveBeenCalledWith(
      'in_a',
      `invoice:${FIELD_INVOICE_ID}:finalize:payment-sheet`,
    );
  });

  it('resumes a half-finished push (FIELD status final) before reading the secret', async () => {
    const { service, sync } = setup();
    const half = { ...onStripe, status: 'final' } as InvoiceRow;
    expect(await service.forInvoice(half)).not.toBeNull();
    expect(sync.pushInvoice).toHaveBeenCalledWith(half, {
      forPaymentSheet: true,
    });
  });

  it('returns the same invoice PaymentIntent on repeat calls, with a new ephemeral key each time', async () => {
    const { service, stripe, sync } = setup();
    const first = await service.forInvoice(onStripe);
    const second = await service.forInvoice(onStripe);
    expect(second?.paymentIntentClientSecret).toBe(
      first?.paymentIntentClientSecret,
    );
    expect(second?.customerEphemeralKeySecret).not.toBe(
      first?.customerEphemeralKeySecret,
    );
    expect(stripe.createEphemeralKey).toHaveBeenCalledTimes(2);
    expect(sync.pushInvoice).not.toHaveBeenCalled();
  });

  it('records a Stripe invoice that is already paid and returns null', async () => {
    const { service, stripe, client } = setup();
    stripe.retrieveInvoiceWithConfirmationSecret.mockResolvedValue(
      stripeInvoice({ status: 'paid', amount_due: 0, amount_paid: 5390 }),
    );
    expect(await service.forInvoice(onStripe)).toBeNull();
    expect(applyInvoiceEventUpdate).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ stripeInvoiceId: 'in_a', status: 'paid' }),
    );
    expect(stripe.createEphemeralKey).not.toHaveBeenCalled();
  });

  it.each([
    ['void on Stripe', { status: 'void' }],
    ['uncollectible on Stripe', { status: 'uncollectible' }],
    ['open with nothing due', { status: 'open', amount_due: 0 }],
  ])('returns null when the invoice is %s', async (_label, fields) => {
    const { service, stripe } = setup();
    stripe.retrieveInvoiceWithConfirmationSecret.mockResolvedValue(
      stripeInvoice(fields),
    );
    expect(await service.forInvoice(onStripe)).toBeNull();
    expect(stripe.createEphemeralKey).not.toHaveBeenCalled();
  });

  it.each(['paid', 'void'])(
    'returns null for a FIELD invoice already %s without calling Stripe',
    async (status) => {
      const { service, stripe } = setup();
      expect(
        await service.forInvoice({ ...onStripe, status } as InvoiceRow),
      ).toBeNull();
      expect(
        stripe.retrieveInvoiceWithConfirmationSecret,
      ).not.toHaveBeenCalled();
    },
  );

  it('returns null and never pushes when Checkout has already taken the payment', async () => {
    const { service, sync, checkout } = setup();
    checkout.closeCheckout.mockResolvedValue('paid');
    expect(await service.forInvoice(notOnStripe)).toBeNull();
    expect(sync.pushInvoice).not.toHaveBeenCalled();
  });

  it('returns null without touching Stripe when no publishable key is configured', async () => {
    const { service, stripe, sync } = setup({ withPublishableKey: false });
    expect(service.isAvailable).toBe(false);
    expect(await service.forInvoice(notOnStripe)).toBeNull();
    expect(sync.pushInvoice).not.toHaveBeenCalled();
    expect(stripe.retrieveInvoiceWithConfirmationSecret).not.toHaveBeenCalled();
  });

  it('turns a Stripe failure into a 502', async () => {
    const { service, stripe } = setup();
    stripe.createEphemeralKey.mockRejectedValue({
      type: 'StripeInvalidRequestError',
      message: 'No such customer',
    });
    await expect(service.forInvoice(onStripe)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
