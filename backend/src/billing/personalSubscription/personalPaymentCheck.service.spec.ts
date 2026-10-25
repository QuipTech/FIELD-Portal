import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { findInvoice } from '../invoices/invoices.repository';
import { StripeService } from '../stripe/stripe.service';
import { applyInvoiceEventUpdate } from '../webhooks/stripeWebhookEvents.repository';
import { PersonalPaymentCheckService } from './personalPaymentCheck.service';
import { PersonalSubscriptionService } from './personalSubscription.service';
import { PersonalCheckoutService } from './personalCheckout.service';

jest.mock('../invoices/invoices.repository', () => ({
  findInvoice: jest.fn(),
}));
jest.mock('../webhooks/stripeWebhookEvents.repository', () => ({
  applyInvoiceEventUpdate: jest.fn().mockResolvedValue(true),
}));

const actor = {
  userId: 'user-a',
  tenantId: 'tenant-a',
  email: 'a@example.com',
};
const unpaid = { paymentRequired: true, invoiceId: 'invoice-a' };
const stripeInvoice = (status: string) => ({
  id: 'in_a',
  status,
  metadata: { fieldInvoiceId: '46eab22d-9761-42a9-87ae-a0b15f91ed11' },
  total: 4900,
  total_excluding_tax: 4900,
  amount_paid: status === 'paid' ? 4900 : 0,
  hosted_invoice_url: 'https://invoice.stripe.com/i/a',
});

const setup = (remoteStatus: string) => {
  const client = {};
  const database = {
    transaction: async (work: (input: typeof client) => unknown) =>
      work(client),
  };
  const subscriptions = {
    getStatus: jest
      .fn()
      .mockResolvedValueOnce(unpaid)
      .mockResolvedValue({ paymentRequired: false }),
  };
  const stripe = {
    retrieveInvoice: jest.fn().mockResolvedValue(stripeInvoice(remoteStatus)),
  };
  const accounts = {
    requireAccount: jest
      .fn()
      .mockResolvedValue({ stripe_customer_id: 'cus_a' }),
  };
  const checkout = { confirmPayment: jest.fn().mockResolvedValue(true) };
  jest.mocked(findInvoice).mockResolvedValue({
    id: 'invoice-a',
    stripe_invoice_id: 'in_a',
  } as Awaited<ReturnType<typeof findInvoice>>);
  const service = new PersonalPaymentCheckService(
    database as unknown as ServiceDatabaseService,
    subscriptions as unknown as PersonalSubscriptionService,
    stripe as unknown as StripeService,
    accounts as unknown as BillingAccountsService,
    checkout as unknown as PersonalCheckoutService,
  );
  return { service, client, subscriptions, stripe, checkout };
};

beforeEach(() => jest.clearAllMocks());

describe('personal payment check', () => {
  it('records a payment Stripe has but whose webhook was missed', async () => {
    const { service, client, stripe } = setup('paid');
    expect(await service.checkPayment(actor)).toEqual({
      paymentRequired: false,
    });
    expect(stripe.retrieveInvoice).toHaveBeenCalledWith('in_a');
    expect(applyInvoiceEventUpdate).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        stripeInvoiceId: 'in_a',
        status: 'paid',
        amountPaidCents: 4900,
      }),
    );
  });

  it('changes nothing while the Stripe invoice is still open', async () => {
    const { service } = setup('open');
    expect(await service.checkPayment(actor)).toEqual(unpaid);
    expect(applyInvoiceEventUpdate).not.toHaveBeenCalled();
  });

  it('does not call Stripe when this month is already paid', async () => {
    const { service, subscriptions, stripe } = setup('paid');
    subscriptions.getStatus.mockReset().mockResolvedValue({
      paymentRequired: false,
      invoiceId: 'invoice-a',
    });
    await service.checkPayment(actor);
    expect(stripe.retrieveInvoice).not.toHaveBeenCalled();
  });

  it('looks for a Checkout payment when no Stripe invoice exists yet', async () => {
    const { service, stripe, checkout } = setup('paid');
    jest.mocked(findInvoice).mockResolvedValue({
      id: 'invoice-a',
      billing_account_id: 'account-a',
      stripe_invoice_id: null,
    } as Awaited<ReturnType<typeof findInvoice>>);
    expect(await service.checkPayment(actor)).toEqual({
      paymentRequired: false,
    });
    expect(checkout.confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'invoice-a' }),
      'cus_a',
    );
    expect(stripe.retrieveInvoice).not.toHaveBeenCalled();
  });

  it('keeps the payment required when Checkout has no payment', async () => {
    const { service, checkout } = setup('paid');
    checkout.confirmPayment.mockResolvedValue(false);
    jest.mocked(findInvoice).mockResolvedValue({
      id: 'invoice-a',
      stripe_invoice_id: null,
    } as Awaited<ReturnType<typeof findInvoice>>);
    expect(await service.checkPayment(actor)).toEqual(unpaid);
  });
});
