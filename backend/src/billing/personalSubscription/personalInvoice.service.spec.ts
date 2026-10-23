import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { InvoiceStripeSyncService } from '../invoices/invoiceStripeSync.service';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { StripeService } from '../stripe/stripe.service';
import { findInvoice } from '../invoices/invoices.repository';
import {
  findPersonalAccount,
  findPersonalPeriods,
  markPersonalPeriodReplaced,
} from './personalSubscription.repository';
import { PersonalInvoiceService } from './personalInvoice.service';
import { PersonalSubscriptionService } from './personalSubscription.service';

jest.mock('../invoices/invoices.repository', () => ({
  findInvoice: jest.fn(),
}));
jest.mock('./personalSubscription.repository', () => ({
  findPersonalAccount: jest.fn(),
  findPersonalPeriods: jest.fn(),
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
  const sync = { pushInvoice: jest.fn().mockResolvedValue(undefined) };
  const stripe = { updateBillingAddress: jest.fn().mockResolvedValue({}) };
  const books = {
    getPinnedPriceBook: jest
      .fn()
      .mockResolvedValue({ id: 'book-a', unitCents: 4900 }),
  };
  jest.mocked(findInvoice).mockResolvedValue({
    id: 'invoice-a',
    billing_account_id: 'account-a',
    status: 'draft',
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
    sync as unknown as InvoiceStripeSyncService,
    stripe as unknown as StripeService,
    books as unknown as PriceBooksService,
  );
  return { service, client, subscriptions, accounts, sync, stripe, books };
};

beforeEach(() => jest.clearAllMocks());

describe('personal payment invoice creation', () => {
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
    });
    expect(client.query).not.toHaveBeenCalled();
  });

  it('locks per user, uses the pinned server price and audits before syncing', async () => {
    const { service, client, books, stripe, sync } = setup();
    expect(await service.createPayment(actor, address)).toMatchObject({
      paymentUrl: status.hostedInvoiceUrl,
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
    expect(sync.pushInvoice).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing period invoice after a failed Stripe attempt', async () => {
    const { service, client, sync } = setup();
    jest
      .mocked(findPersonalPeriods)
      .mockResolvedValue([
        { period_start: status.periodStart, invoice_id: 'invoice-a' },
      ] as Awaited<ReturnType<typeof findPersonalPeriods>>);
    sync.pushInvoice.mockRejectedValueOnce(new Error('Stripe unavailable'));
    await expect(service.createPayment(actor, address)).rejects.toThrow(
      'Stripe unavailable',
    );
    await service.createPayment(actor, address);
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO billing.invoices'),
      ),
    ).toBe(false);
    expect(sync.pushInvoice).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['refunded', { status: 'paid', amount_refunded_cents: '5390' }],
    ['void', { status: 'void', amount_refunded_cents: '0' }],
  ])(
    'replaces a %s invoice with a new one for the same month',
    async (_label, invoiceState) => {
      const { service, client, sync } = setup();
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
      expect(sync.pushInvoice).toHaveBeenCalledTimes(1);
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
    const { service, sync, stripe } = setup();
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
    });
    expect(sync.pushInvoice).not.toHaveBeenCalled();
    expect(stripe.updateBillingAddress).not.toHaveBeenCalled();
  });
});
