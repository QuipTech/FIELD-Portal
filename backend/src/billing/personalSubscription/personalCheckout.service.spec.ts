import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { listInvoiceLines } from '../invoices/invoices.repository';
import { InvoiceRow } from '../invoices/types/invoiceRows';
import { StripeService } from '../stripe/stripe.service';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import {
  PersonalCheckoutService,
  toReturnOrigin,
} from './personalCheckout.service';

jest.mock('../invoices/invoices.repository', () => ({
  listInvoiceLines: jest.fn(),
}));
jest.mock('../webhooks/stripeWebhookEvents.repository', () => ({
  applyInvoiceEventUpdate: jest.fn().mockResolvedValue(true),
}));

const ORIGIN = 'http://localhost:3001';
const invoice = { id: 'invoice-a', currency: 'AUD' } as InvoiceRow;
const session = (fields: Record<string, unknown>) => ({
  status: 'open',
  payment_status: 'unpaid',
  url: 'https://checkout.stripe.com/c/pay/open',
  success_url: `${ORIGIN}/settings/billing?payment=complete`,
  invoice: null,
  ...fields,
});

const setup = (sessions: ReturnType<typeof session>[]) => {
  const client = {};
  const database = {
    transaction: async (work: (input: typeof client) => unknown) =>
      work(client),
  };
  const stripe = {
    listCheckoutSessions: jest.fn().mockResolvedValue(sessions),
    createCheckoutSession: jest
      .fn()
      .mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/new' }),
    retrieveInvoice: jest.fn().mockResolvedValue({
      id: 'in_checkout',
      status: 'paid',
      metadata: { fieldInvoiceId: '46eab22d-9761-42a9-87ae-a0b15f91ed11' },
      total: 5390,
      total_excluding_tax: 4900,
      amount_paid: 5390,
      hosted_invoice_url: null,
    }),
  };
  jest
    .mocked(listInvoiceLines)
    .mockResolvedValue([
      { amount_cents: '4900', description: 'FIELD Technician — October 2026' },
    ] as Awaited<ReturnType<typeof listInvoiceLines>>);
  const service = new PersonalCheckoutService(
    database as unknown as ServiceDatabaseService,
    stripe as unknown as StripeService,
  );
  return { service, stripe, client };
};

beforeEach(() => jest.clearAllMocks());

describe('personal Checkout', () => {
  it('charges the FIELD invoice amount and returns to the portal billing page', async () => {
    const { service, stripe } = setup([]);
    expect(await service.openCheckout(invoice, 'cus_a', ORIGIN)).toBe(
      'https://checkout.stripe.com/c/pay/new',
    );
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      {
        customerId: 'cus_a',
        currency: 'AUD',
        amountCents: 4900,
        description: 'FIELD Technician — October 2026',
        fieldInvoiceId: 'invoice-a',
        successUrl: `${ORIGIN}/settings/billing?payment=complete`,
        cancelUrl: `${ORIGIN}/settings/billing?payment=cancelled`,
      },
      `invoice:invoice-a:checkout:0:${ORIGIN}`,
    );
  });

  it('reuses an open session instead of starting a second payment', async () => {
    const { service, stripe } = setup([session({})]);
    expect(await service.openCheckout(invoice, 'cus_a', ORIGIN)).toBe(
      'https://checkout.stripe.com/c/pay/open',
    );
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns a mobile payer to the app hand-back page', async () => {
    const { service, stripe } = setup([]);
    await service.openCheckout(invoice, 'cus_a', ORIGIN, 'app');
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: `${ORIGIN}/app-return/billing?payment=complete`,
        cancelUrl: `${ORIGIN}/app-return/billing?payment=cancelled`,
      }),
      `invoice:invoice-a:checkout:0:${ORIGIN}:app`,
    );
  });

  it("doesn't hand the app an open session that returns to the website", async () => {
    const { service, stripe } = setup([session({})]);
    expect(await service.openCheckout(invoice, 'cus_a', ORIGIN, 'app')).toBe(
      'https://checkout.stripe.com/c/pay/new',
    );
    expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it('replaces an expired session with a new key', async () => {
    const { service, stripe } = setup([session({ status: 'expired' })]);
    await service.openCheckout(invoice, 'cus_a', ORIGIN);
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.anything(),
      `invoice:invoice-a:checkout:1:${ORIGIN}`,
    );
  });

  it('never opens a second payment once Stripe has one, and records it', async () => {
    const { service, stripe, client } = setup([
      session({
        status: 'complete',
        payment_status: 'paid',
        invoice: 'in_checkout',
      }),
    ]);
    expect(await service.openCheckout(invoice, 'cus_a', ORIGIN)).toBeNull();
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
    expect(applyInvoiceEventUpdate).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        stripeInvoiceId: 'in_checkout',
        status: 'paid',
      }),
    );
  });

  it('records nothing while no Checkout payment has completed', async () => {
    const { service } = setup([session({})]);
    expect(await service.confirmPayment(invoice, 'cus_a')).toBe(false);
    expect(applyInvoiceEventUpdate).not.toHaveBeenCalled();
  });

  it('returns only to a configured portal origin', () => {
    expect(toReturnOrigin(ORIGIN)).toBe(ORIGIN);
    expect(toReturnOrigin('https://evil.example')).toBe(ORIGIN);
    expect(toReturnOrigin(undefined)).toBe(ORIGIN);
  });
});
