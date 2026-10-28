import * as Stripe from 'stripe';
import { StripeService } from '../stripe/stripe.service';
import {
  buildInvoiceRow,
  createFakeBillingDatabase,
  FakeBillingState,
} from '../billingFakeDatabase';
import { StripeWebhookService } from './stripeWebhook.service';

const FIELD_INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const STRIPE_INVOICE_ID = 'in_test_123';

const invoiceEvent = (id: string, type: string, overrides = {}) =>
  ({
    id,
    type,
    data: {
      object: {
        id: STRIPE_INVOICE_ID,
        metadata: { fieldInvoiceId: FIELD_INVOICE_ID },
        total: 16500,
        total_excluding_tax: 15000,
        amount_paid: 16500,
        hosted_invoice_url: 'https://invoice.stripe.com/i/test',
        ...overrides,
      },
    },
  }) as unknown as Stripe.Event;

let state: FakeBillingState;
let service: StripeWebhookService;
const stripeService = {
  findInvoiceIdForPaymentIntent: jest.fn(),
};

beforeEach(() => {
  state = {
    invoices: [
      buildInvoiceRow({
        status: 'synced',
        stripe_invoice_id: STRIPE_INVOICE_ID,
      }),
    ],
    lines: [],
    webhookEventIds: new Set(),
  };
  const { serviceDatabase } = createFakeBillingDatabase(state);
  service = new StripeWebhookService(
    serviceDatabase,
    stripeService as unknown as StripeService,
  );
});

describe('StripeWebhookService', () => {
  it('sets our invoice to paid on invoice.paid, with Stripe totals', async () => {
    const outcome = await service.handleEvent(
      invoiceEvent('evt_1', 'invoice.paid'),
    );
    expect(outcome).toEqual({ status: 'processed' });
    expect(state.invoices[0]).toMatchObject({
      status: 'paid',
      total_ex_gst_cents: '15000',
      gst_cents: '1500',
      total_cents: '16500',
      amount_paid_cents: '16500',
    });
  });

  it('processes the same event only once', async () => {
    const event = invoiceEvent('evt_dup', 'invoice.payment_failed');
    const first = await service.handleEvent(event);
    // An admin-side change after the first delivery must survive the redelivery.
    state.invoices[0].status = 'synced';
    const second = await service.handleEvent(event);
    expect(first).toEqual({ status: 'processed' });
    expect(second).toEqual({ status: 'duplicate' });
    expect(state.invoices[0].status).toBe('synced');
    expect(state.webhookEventIds.size).toBe(1);
  });

  it('never moves a paid invoice back to payment_failed', async () => {
    await service.handleEvent(invoiceEvent('evt_paid', 'invoice.paid'));
    await service.handleEvent(
      invoiceEvent('evt_late', 'invoice.payment_failed', { amount_paid: 0 }),
    );
    expect(state.invoices[0].status).toBe('paid');
    expect(state.invoices[0].amount_paid_cents).toBe('16500');
  });

  it('records a refund as a total, leaving the invoice paid', async () => {
    state.invoices[0].status = 'paid';
    stripeService.findInvoiceIdForPaymentIntent.mockResolvedValue(
      STRIPE_INVOICE_ID,
    );
    const refund = {
      id: 'evt_refund',
      type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_1', amount_refunded: 5000 } },
    } as unknown as Stripe.Event;
    await expect(service.handleEvent(refund)).resolves.toEqual({
      status: 'processed',
    });
    expect(state.invoices[0]).toMatchObject({
      status: 'paid',
      amount_refunded_cents: '5000',
    });
  });

  it('acknowledges events for invoices that are not ours', async () => {
    const outcome = await service.handleEvent(
      invoiceEvent('evt_other', 'invoice.paid', {
        id: 'in_other',
        metadata: {},
      }),
    );
    expect(outcome).toEqual({ status: 'ignored' });
    expect(state.invoices[0].status).toBe('synced');
  });
});
