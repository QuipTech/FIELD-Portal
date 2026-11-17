import { ConfigService } from '@nestjs/config';
import { STRIPE_API_VERSION, StripeService } from './stripe.service';

// The request shapes sent to Stripe, checked against a fake SDK client.
const createService = () => {
  const service = new StripeService({
    get: (key: string) =>
      ({ STRIPE_SECRET_KEY: 'sk_test_example', NODE_ENV: 'test' })[key],
  } as unknown as ConfigService);
  const client = {
    invoices: {
      create: jest.fn().mockResolvedValue({ id: 'in_a' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'in_a' }),
      finalizeInvoice: jest.fn().mockResolvedValue({ id: 'in_a' }),
    },
    ephemeralKeys: { create: jest.fn().mockResolvedValue({ secret: 'ek' }) },
    checkout: { sessions: { expire: jest.fn().mockResolvedValue({}) } },
  };
  (service as unknown as { client: typeof client }).client = client;
  return { service, client };
};

describe('StripeService Payment Sheet calls', () => {
  it('uses an API version from basil (2025-03-31) on, so invoices carry confirmation_secret', () => {
    expect(STRIPE_API_VERSION).toBe('2026-08-26.dahlia');
    expect(STRIPE_API_VERSION.slice(0, 10) >= '2025-03-31').toBe(true);
  });

  it('reads the invoice PaymentIntent secret through confirmation_secret', async () => {
    const { service, client } = createService();
    await service.retrieveInvoiceWithConfirmationSecret('in_a');
    expect(client.invoices.retrieve).toHaveBeenCalledWith('in_a', {
      expand: ['confirmation_secret'],
    });
    await service.finalizeInvoiceWithConfirmationSecret('in_a', 'key-a');
    expect(client.invoices.finalizeInvoice).toHaveBeenCalledWith(
      'in_a',
      { auto_advance: false, expand: ['confirmation_secret'] },
      { idempotencyKey: 'key-a' },
    );
  });

  it('creates every ephemeral key with the pinned API version and no idempotency key', async () => {
    const { service, client } = createService();
    await service.createEphemeralKey('cus_a');
    await service.createEphemeralKey('cus_a');
    expect(client.ephemeralKeys.create).toHaveBeenCalledTimes(2);
    expect(client.ephemeralKeys.create).toHaveBeenCalledWith(
      { customer: 'cus_a' },
      { apiVersion: STRIPE_API_VERSION },
    );
  });

  it('restricts an invoice to cards only when asked', async () => {
    const { service, client } = createService();
    const input = {
      customerId: 'cus_a',
      currency: 'AUD',
      fieldInvoiceId: 'invoice-a',
      daysUntilDue: 14,
      chargeAutomatically: false,
    };
    await service.createInvoice(
      { ...input, paymentMethodTypes: ['card'] },
      'key-card',
    );
    expect(client.invoices.create.mock.calls[0][0]).toMatchObject({
      payment_settings: { payment_method_types: ['card'] },
    });
    await service.createInvoice(input, 'key-default');
    expect(client.invoices.create.mock.calls[1][0]).not.toHaveProperty(
      'payment_settings',
    );
  });

  it('expires a Checkout session by id', async () => {
    const { service, client } = createService();
    await service.expireCheckoutSession('cs_a');
    expect(client.checkout.sessions.expire).toHaveBeenCalledWith('cs_a');
  });
});
