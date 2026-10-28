import { StripeService } from '../stripe/stripe.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import {
  buildInvoiceRow,
  buildLineRow,
  createFakeBillingDatabase,
  FakeBillingState,
} from '../billingFakeDatabase';
import { InvoiceStripeSyncService } from './invoiceStripeSync.service';

// A fake Stripe that, like the real one, answers a repeated idempotency
// key with the original object instead of creating another.
const createFakeStripe = () => {
  const itemsByKey = new Map<string, { id: string }>();
  let itemCount = 0;
  return {
    itemsByKey,
    createInvoice: jest.fn().mockResolvedValue({ id: 'in_test_1' }),
    createInvoiceItem: jest.fn(async (_input: unknown, key: string) => {
      if (!itemsByKey.has(key))
        itemsByKey.set(key, { id: `ii_${++itemCount}` });
      return itemsByKey.get(key);
    }),
    finalizeInvoice: jest.fn().mockResolvedValue({
      id: 'in_test_1',
      status: 'open',
      collection_method: 'send_invoice',
      due_date: 1793491200,
      total: 16500,
      total_excluding_tax: 15000,
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
    }),
    hasDefaultPaymentMethod: jest.fn().mockResolvedValue(false),
    payInvoice: jest.fn().mockResolvedValue({}),
  };
};

const account = {
  id: '22222222-2222-4222-8222-222222222222',
  stripe_customer_id: 'cus_test_1',
};
const billingAccounts = {
  requireAccount: jest.fn().mockResolvedValue(account),
  ensureStripeCustomer: jest.fn().mockResolvedValue(account),
};

let state: FakeBillingState;
let stripe: ReturnType<typeof createFakeStripe>;
let service: InvoiceStripeSyncService;

beforeEach(() => {
  const invoice = buildInvoiceRow();
  state = {
    invoices: [invoice],
    lines: [1, 2, 3].map((position) => buildLineRow(position, invoice.id)),
    webhookEventIds: new Set(),
  };
  stripe = createFakeStripe();
  service = new InvoiceStripeSyncService(
    createFakeBillingDatabase(state).serviceDatabase,
    billingAccounts as unknown as BillingAccountsService,
    stripe as unknown as StripeService,
    {
      loadConfig: async () => ({ PAYMENT_TERMS_DAYS: 21 }),
    } as unknown as BillingConfigService,
  );
});

describe('InvoiceStripeSyncService', () => {
  it('pushes one item per line, keyed by our line id, then marks synced', async () => {
    await service.pushInvoice(state.invoices[0]);
    expect(stripe.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ daysUntilDue: 21 }),
      expect.any(String),
    );
    const keys = stripe.createInvoiceItem.mock.calls.map((call) => call[1]);
    expect(keys).toEqual(state.lines.map((line) => line.id));
    expect(state.invoices[0]).toMatchObject({
      status: 'synced',
      stripe_invoice_id: 'in_test_1',
      gst_cents: '1500',
      total_cents: '16500',
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
    });
  });

  it('does not create duplicate Stripe items when the same lines are pushed twice', async () => {
    await service.pushInvoice(state.invoices[0]);
    await service.pushInvoice(state.invoices[0]);
    expect(stripe.itemsByKey.size).toBe(3);
    // The saved item ids make the second push skip the lines entirely.
    expect(stripe.createInvoiceItem).toHaveBeenCalledTimes(3);
    expect(stripe.createInvoice).toHaveBeenCalledTimes(1);
  });

  it('a retry after a lost response reuses the same idempotency key', async () => {
    // Stripe created the item but our save never happened.
    const line = state.lines[0];
    await stripe.createInvoiceItem({}, line.id);
    await service.pushInvoice(state.invoices[0]);
    expect(stripe.itemsByKey.size).toBe(3);
    expect(line.stripe_invoice_item_id).toBe('ii_1');
  });

  it('emails the invoice with payment terms when no card is on file', async () => {
    await service.pushInvoice(state.invoices[0]);
    expect(stripe.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ chargeAutomatically: false }),
      expect.any(String),
    );
    expect(stripe.payInvoice).not.toHaveBeenCalled();
  });

  it('charges the card or direct debit on file straight away (spec section 9)', async () => {
    stripe.hasDefaultPaymentMethod.mockResolvedValue(true);
    stripe.finalizeInvoice.mockResolvedValue({
      id: 'in_test_1',
      status: 'open',
      collection_method: 'charge_automatically',
      total: 16500,
      total_excluding_tax: 15000,
      hosted_invoice_url: 'https://invoice.stripe.com/i/test',
    });
    await service.pushInvoice(state.invoices[0]);
    expect(stripe.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ chargeAutomatically: true }),
      expect.any(String),
    );
    expect(stripe.payInvoice).toHaveBeenCalledWith(
      'in_test_1',
      `invoice:${state.invoices[0].id}:pay`,
    );
  });

  it('leaves a declined automatic charge to the payment_failed webhook', async () => {
    stripe.hasDefaultPaymentMethod.mockResolvedValue(true);
    stripe.finalizeInvoice.mockResolvedValue({
      id: 'in_test_1',
      status: 'open',
      collection_method: 'charge_automatically',
      total: 16500,
      total_excluding_tax: 15000,
      hosted_invoice_url: null,
    });
    stripe.payInvoice.mockRejectedValue(new Error('card_declined'));
    await expect(
      service.pushInvoice(state.invoices[0]),
    ).resolves.toBeUndefined();
    expect(state.invoices[0]).toMatchObject({ status: 'synced' });
  });
});
