import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { StripeService } from '../stripe/stripe.service';
import { findInvoice } from '../invoices/invoices.repository';
import {
  findPersonalAccount,
  findPersonalInvoiceHistory,
  findPersonalPeriods,
  markPersonalPeriodReplaced,
} from './personalSubscription.repository';
import { PersonalInvoiceService } from './personalInvoice.service';
import { PersonalSubscriptionService } from './personalSubscription.service';
import { PersonalCheckoutService } from './personalCheckout.service';
import { InvoicePaymentSheetService } from '../invoices/invoicePaymentSheet.service';

jest.mock('../invoices/invoices.repository', () => ({
  findInvoice: jest.fn(),
}));
jest.mock('./personalSubscription.repository', () => ({
  findPersonalAccount: jest.fn(),
  findPersonalPeriods: jest.fn(),
  findPersonalInvoiceHistory: jest.fn(),
  markPersonalPeriodReplaced: jest.fn(),
}));

const actor = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  email: 'a@example.com',
};
const address = {
  line1: '1 Example St',
  city: 'Brisbane',
  state: 'QLD',
  postalCode: '4000',
};
const status = {
  userSubscriptionRequired: true,
  exempt: false,
  paymentRequired: true,
  priceBookId: 'book-a',
  monthlyCents: 4900,
  currency: 'AUD',
  timezone: 'Australia/Brisbane',
  periodStart: '2026-10-01',
  periodEnd: '2026-11-01',
  hostedInvoiceUrl: 'https://invoice.stripe.com/i/a',
};

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/a';
const PAYMENT_SHEET = {
  publishableKey: 'pk_test_field',
  paymentIntentClientSecret: 'pi_invoice_a_secret_abc',
  customerId: 'cus_a',
  customerEphemeralKeySecret: 'ek_test_1',
  merchantDisplayName: 'FIELD',
};

const setup = () => {
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [{ id: 'invoice-a' }] }),
  };
  const database = {
    transaction: async (work: (input: typeof client) => unknown) =>
      work(client),
  };
  const subscriptions = { getStatus: jest.fn().mockResolvedValue(status) };
  const accounts = {
    requireAccount: jest.fn().mockResolvedValue({ id: 'account-a' }),
    ensureStripeCustomer: jest
      .fn()
      .mockResolvedValue({ stripe_customer_id: 'cus_a' }),
  };
  const checkout = { openCheckout: jest.fn().mockResolvedValue(CHECKOUT_URL) };
  const stripe = { updateBillingAddress: jest.fn().mockResolvedValue({}) };
  const books = {
    getPinnedPriceBook: jest
      .fn()
      .mockResolvedValue({ id: 'book-a', unitCents: 4900 }),
  };
  const paymentSheets = {
    isAvailable: true,
    forInvoice: jest.fn().mockResolvedValue(PAYMENT_SHEET),
  };
  jest.mocked(findInvoice).mockResolvedValue({
    id: 'invoice-a',
    billing_account_id: 'account-a',
    status: 'draft',
    stripe_invoice_id: null,
    hosted_invoice_url: null,
  } as Awaited<ReturnType<typeof findInvoice>>);
  jest.mocked(findPersonalAccount).mockResolvedValue({
    billing_account_id: 'account-a',
    timezone: status.timezone,
  });
  jest.mocked(findPersonalPeriods).mockResolvedValue([]);
  const service = new PersonalInvoiceService(
    database as unknown as ServiceDatabaseService,
    subscriptions as unknown as PersonalSubscriptionService,
    accounts as unknown as BillingAccountsService,
    checkout as unknown as PersonalCheckoutService,
    stripe as unknown as StripeService,
    books as unknown as PriceBooksService,
    paymentSheets as unknown as InvoicePaymentSheetService,
  );
  return {
    service,
    client,
    subscriptions,
    accounts,
    checkout,
    stripe,
    books,
    paymentSheets,
  };
};

beforeEach(() => jest.clearAllMocks());

describe('personal payment invoice creation', () => {
  it('refuses with 409 when there is no user subscription, before any write', async () => {
    const { service, client, subscriptions } = setup();
    subscriptions.getStatus.mockResolvedValue({
      ...status,
      userSubscriptionRequired: false,
      paymentRequired: false,
    });
    await expect(service.createPayment(actor, address)).rejects.toMatchObject({
      status: 409,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('refuses Owner payments before any money-changing write', async () => {
    const { service, client, subscriptions } = setup();
    subscriptions.getStatus.mockResolvedValue({ ...status, exempt: true });
    await expect(service.createPayment(actor, address)).rejects.toThrow(
      'Owners',
    );
    expect(client.query).not.toHaveBeenCalled();
  });

  it('does not create another payment if this month is already paid', async () => {
    const { service, client, subscriptions } = setup();
    subscriptions.getStatus.mockResolvedValue({
      ...status,
      paymentRequired: false,
    });
    expect(await service.createPayment(actor, address)).toMatchObject({
      paymentUrl: null,
      paymentSheet: null,
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('locks per user, uses the pinned server price and audits before Checkout', async () => {
    const { service, client, books, stripe, checkout } = setup();
    expect(await service.createPayment(actor, address)).toMatchObject({
      paymentUrl: CHECKOUT_URL,
    });
    expect(client.query.mock.calls[0]).toEqual([
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      ['personal-billing:user-a'],
    ]);
    expect(books.getPinnedPriceBook).toHaveBeenCalledWith('book-a');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO billing.invoices'),
      ['account-a', 4900],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('billing.record_audit_entry'),
      expect.any(Array),
    );
    expect(stripe.updateBillingAddress).toHaveBeenCalledWith('cus_a', address);
    expect(checkout.openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'invoice-a' }),
      'cus_a',
      'http://localhost:3001',
      'portal',
    );
  });

  it('opens Checkout that returns to the mobile app when the Payment Sheet is not configured', async () => {
    const { service, checkout, paymentSheets } = setup();
    paymentSheets.isAvailable = false;
    expect(
      await service.createPayment(actor, { ...address, returnTo: 'app' }),
    ).toMatchObject({ paymentUrl: CHECKOUT_URL, paymentSheet: null });
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
    expect(checkout.openCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'invoice-a' }),
      'cus_a',
      'http://localhost:3001',
      'app',
    );
  });

  it('reuses the existing period invoice after a failed Stripe attempt', async () => {
    const { service, client, checkout } = setup();
    jest
      .mocked(findPersonalPeriods)
      .mockResolvedValue([
        { period_start: status.periodStart, invoice_id: 'invoice-a' },
      ] as Awaited<ReturnType<typeof findPersonalPeriods>>);
    checkout.openCheckout.mockRejectedValueOnce(
      new Error('Stripe unavailable'),
    );
    await expect(service.createPayment(actor, address)).rejects.toThrow(
      'Stripe unavailable',
    );
    await service.createPayment(actor, address);
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO billing.invoices'),
      ),
    ).toBe(false);
    expect(checkout.openCheckout).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['refunded', { status: 'paid', amount_refunded_cents: '5390' }],
    ['void', { status: 'void', amount_refunded_cents: '0' }],
  ])(
    'replaces a %s invoice with a new one for the same month',
    async (_label, invoiceState) => {
      const { service, client, checkout } = setup();
      jest.mocked(findPersonalPeriods).mockResolvedValue([
        {
          id: 'period-old',
          period_start: status.periodStart,
          invoice_id: 'invoice-old',
          billing_account_id: 'account-a',
          ...invoiceState,
        },
      ] as Awaited<ReturnType<typeof findPersonalPeriods>>);
      await service.createPayment(actor, address);
      expect(markPersonalPeriodReplaced).toHaveBeenCalledWith(
        client,
        'period-old',
      );
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO billing.invoices'),
        ['account-a', 4900],
      );
      expect(checkout.openCheckout).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps a payment_failed invoice so the user retries the same one', async () => {
    const { service } = setup();
    jest.mocked(findPersonalPeriods).mockResolvedValue([
      {
        id: 'period-a',
        period_start: status.periodStart,
        invoice_id: 'invoice-a',
        status: 'payment_failed',
        amount_refunded_cents: '0',
      },
    ] as Awaited<ReturnType<typeof findPersonalPeriods>>);
    await service.createPayment(actor, address);
    expect(markPersonalPeriodReplaced).not.toHaveBeenCalled();
  });

  it('returns an existing hosted link without re-finalising a Stripe invoice', async () => {
    const { service, checkout, stripe } = setup();
    jest
      .mocked(findPersonalPeriods)
      .mockResolvedValue([
        { period_start: status.periodStart, invoice_id: 'invoice-a' },
      ] as Awaited<ReturnType<typeof findPersonalPeriods>>);
    jest.mocked(findInvoice).mockResolvedValue({
      id: 'invoice-a',
      status: 'synced',
      hosted_invoice_url: status.hostedInvoiceUrl,
    } as Awaited<ReturnType<typeof findInvoice>>);
    expect(await service.createPayment(actor, address)).toMatchObject({
      paymentUrl: status.hostedInvoiceUrl,
      paymentSheet: null,
    });
    expect(checkout.openCheckout).not.toHaveBeenCalled();
    expect(stripe.updateBillingAddress).not.toHaveBeenCalled();
  });
});

describe('personal payment in the mobile Payment Sheet', () => {
  const app = { ...address, returnTo: 'app' as const };

  it("returns paymentSheet and keeps paymentUrl (the same invoice's hosted page)", async () => {
    const { service, checkout, paymentSheets } = setup();
    const response = await service.createPayment(actor, app);
    expect(response).toMatchObject({
      ...status,
      paymentUrl: status.hostedInvoiceUrl,
      paymentSheet: PAYMENT_SHEET,
    });
    expect(paymentSheets.forInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'invoice-a' }),
    );
    // No Checkout session competes with the invoice's own PaymentIntent.
    expect(checkout.openCheckout).not.toHaveBeenCalled();
  });

  it('saves the billing address before the invoice goes to Stripe, so GST is right', async () => {
    const { service, stripe, paymentSheets } = setup();
    await service.createPayment(actor, app);
    expect(stripe.updateBillingAddress).toHaveBeenCalledWith('cus_a', app);
    expect(
      stripe.updateBillingAddress.mock.invocationCallOrder[0],
    ).toBeLessThan(paymentSheets.forInvoice.mock.invocationCallOrder[0]);
  });

  it('leaves the address alone once the Stripe invoice exists (its tax is fixed)', async () => {
    const { service, stripe, paymentSheets } = setup();
    jest.mocked(findInvoice).mockResolvedValue({
      id: 'invoice-a',
      billing_account_id: 'account-a',
      status: 'synced',
      stripe_invoice_id: 'in_a',
      hosted_invoice_url: status.hostedInvoiceUrl,
    } as Awaited<ReturnType<typeof findInvoice>>);
    expect(await service.createPayment(actor, app)).toMatchObject({
      paymentSheet: PAYMENT_SHEET,
    });
    expect(stripe.updateBillingAddress).not.toHaveBeenCalled();
    expect(paymentSheets.forInvoice).toHaveBeenCalledTimes(1);
  });

  it('two calls in a row reuse one invoice and return the same PaymentIntent', async () => {
    const { service, client, paymentSheets } = setup();
    const first = await service.createPayment(actor, app);
    jest
      .mocked(findPersonalPeriods)
      .mockResolvedValue([
        { period_start: status.periodStart, invoice_id: 'invoice-a' },
      ] as Awaited<ReturnType<typeof findPersonalPeriods>>);
    const second = await service.createPayment(actor, app);
    const inserts = client.query.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO billing.invoices'),
    );
    expect(inserts).toHaveLength(1);
    expect(paymentSheets.forInvoice.mock.calls.map(([row]) => row.id)).toEqual([
      'invoice-a',
      'invoice-a',
    ]);
    expect(second.paymentSheet?.paymentIntentClientSecret).toBe(
      first.paymentSheet?.paymentIntentClientSecret,
    );
  });

  it('returns null paymentSheet when the payment was taken meanwhile', async () => {
    const { service, subscriptions, paymentSheets } = setup();
    paymentSheets.forInvoice.mockResolvedValue(null);
    subscriptions.getStatus
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({ ...status, paymentRequired: false });
    expect(await service.createPayment(actor, app)).toMatchObject({
      paymentRequired: false,
      paymentUrl: null,
      paymentSheet: null,
    });
  });

  it.each([
    ['covered by the organisation', { coveredByOrganisation: true }],
    ['already paid', { invoiceStatus: 'paid' }],
  ])('returns null paymentSheet when %s', async (_label, override) => {
    const { service, client, subscriptions, paymentSheets } = setup();
    subscriptions.getStatus.mockResolvedValue({
      ...status,
      ...override,
      paymentRequired: false,
    });
    expect(await service.createPayment(actor, app)).toMatchObject({
      paymentUrl: null,
      paymentSheet: null,
    });
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  it('refuses Owners (exempt) with 403 and no paymentSheet', async () => {
    const { service, subscriptions, paymentSheets } = setup();
    subscriptions.getStatus.mockResolvedValue({ ...status, exempt: true });
    await expect(service.createPayment(actor, app)).rejects.toThrow('Owners');
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
  });

  it('never gives the portal a paymentSheet: it keeps Checkout', async () => {
    const { service, paymentSheets } = setup();
    expect(await service.createPayment(actor, address)).toMatchObject({
      paymentUrl: CHECKOUT_URL,
      paymentSheet: null,
    });
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
  });
});

describe('Payment Sheet for an earlier unpaid invoice', () => {
  const period = (fields: Record<string, unknown>) =>
    ({
      invoice_id: 'invoice-old',
      period_start: '2026-09-01',
      status: 'synced',
      amount_refunded_cents: '0',
      ...fields,
    }) as Awaited<ReturnType<typeof findPersonalInvoiceHistory>>[number];

  it("returns the sheet for one of the caller's own unpaid invoices", async () => {
    const { service, paymentSheets } = setup();
    jest.mocked(findPersonalInvoiceHistory).mockResolvedValue([period({})]);
    jest.mocked(findInvoice).mockResolvedValue({
      id: 'invoice-old',
      status: 'synced',
    } as Awaited<ReturnType<typeof findInvoice>>);
    expect(await service.paymentSheetForInvoice(actor, 'invoice-old')).toEqual({
      paymentSheet: PAYMENT_SHEET,
    });
    expect(findPersonalInvoiceHistory).toHaveBeenCalledWith(
      expect.anything(),
      actor,
    );
    expect(paymentSheets.forInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'invoice-old' }),
    );
  });

  it("404s for an invoice that isn't the caller's", async () => {
    const { service, paymentSheets } = setup();
    jest.mocked(findPersonalInvoiceHistory).mockResolvedValue([period({})]);
    await expect(
      service.paymentSheetForInvoice(actor, 'someone-elses'),
    ).rejects.toThrow('Invoice not found.');
    expect(findInvoice).not.toHaveBeenCalled();
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ['paid', { status: 'paid' }],
    ['void', { status: 'void' }],
    ['refunded', { status: 'paid', amount_refunded_cents: '5390' }],
  ])('returns null for a %s invoice', async (_label, fields) => {
    const { service, paymentSheets } = setup();
    jest.mocked(findPersonalInvoiceHistory).mockResolvedValue([period(fields)]);
    expect(await service.paymentSheetForInvoice(actor, 'invoice-old')).toEqual({
      paymentSheet: null,
    });
    expect(paymentSheets.forInvoice).not.toHaveBeenCalled();
  });
});
