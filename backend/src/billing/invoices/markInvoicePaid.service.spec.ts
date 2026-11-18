import { ConflictException } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { buildInvoiceRow } from '../billingFakeDatabase';
import { StripeService } from '../stripe/stripe.service';
import * as invoicesRepository from './invoices.repository';
import { InvoicesService } from './invoices.service';
import { MarkInvoicePaidService } from './markInvoicePaid.service';

jest.mock('./invoices.repository');
jest.mock('../billingAudit/billingAudit', () => ({
  recordBillingAudit: jest.fn(),
}));

const repo = jest.mocked(invoicesRepository);
const admin = {
  userId: 'user-q',
  tenantId: 'tenant-q',
  email: 'q@quiptech.au',
};
const input = {
  paidOn: '2026-11-17',
  method: 'bank_transfer' as const,
  reference: 'EFT 8812',
};

const sentInvoice = buildInvoiceRow({
  status: 'synced',
  kind: 'monthly',
  stripe_invoice_id: 'in_1',
  collection_method: 'send_invoice',
  total_cents: '16500',
});

const setup = () => {
  const client = {
    query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
  };
  const database = {
    transaction: async (work: (c: typeof client) => unknown) => work(client),
  };
  const stripe = {
    payInvoiceOutOfBand: jest.fn().mockResolvedValue({
      id: 'in_1',
      status: 'paid',
      metadata: {},
      total: 16500,
      total_excluding_tax: 15000,
      amount_paid: 16500,
      hosted_invoice_url: null,
    }),
    retrieveInvoice: jest.fn(),
  };
  const invoices = {
    getInvoice: jest
      .fn()
      .mockResolvedValue({ id: sentInvoice.id, status: 'paid' }),
  };
  const service = new MarkInvoicePaidService(
    database as unknown as ServiceDatabaseService,
    stripe as unknown as StripeService,
    invoices as unknown as InvoicesService,
  );
  return { service, client, stripe };
};

beforeEach(() => jest.clearAllMocks());

describe('mark as paid', () => {
  it('marks the Stripe invoice paid out of band and FIELD paid, audited', async () => {
    repo.findInvoice.mockResolvedValue(sentInvoice);
    const { service, client, stripe } = setup();
    await service.markPaid(admin, sentInvoice.id, input);
    expect(stripe.payInvoiceOutOfBand).toHaveBeenCalledWith(
      'in_1',
      `invoice:${sentInvoice.id}:paid-out-of-band`,
    );
    const sql = client.query.mock.calls.map((call) => call[0] as string);
    // The webhook-shaped update, then the payment details.
    expect(sql[0]).toContain('stripe_invoice_id = COALESCE');
    expect(client.query.mock.calls[0][1][3]).toBe('paid');
    expect(sql[1]).toContain('marked_paid_on = $2');
    expect(client.query.mock.calls[1][1]).toEqual([
      sentInvoice.id,
      '2026-11-17',
      'bank_transfer',
      'EFT 8812',
      'user-q',
    ]);
    expect(recordBillingAudit).toHaveBeenCalledWith(
      client,
      admin,
      expect.objectContaining({
        to: expect.objectContaining({ status: 'paid', paidOutOfBand: true }),
      }),
    );
  });

  it('accepts an invoice Stripe already has as paid (a retry)', async () => {
    repo.findInvoice.mockResolvedValue(sentInvoice);
    const { service, stripe } = setup();
    stripe.payInvoiceOutOfBand.mockRejectedValue(
      new Error('Invoice is already paid'),
    );
    stripe.retrieveInvoice.mockResolvedValue({
      id: 'in_1',
      status: 'paid',
      metadata: {},
      total: 16500,
      amount_paid: 16500,
    });
    await expect(
      service.markPaid(admin, sentInvoice.id, input),
    ).resolves.toBeDefined();
  });

  it.each([
    [
      'a card that is charged automatically',
      { collection_method: 'charge_automatically' as const },
    ],
    ['a draft', { status: 'draft' as const }],
    ['a paid invoice', { status: 'paid' as const }],
    ['a personal invoice', { kind: 'personal' }],
  ])('refuses %s without touching Stripe', async (_label, overrides) => {
    repo.findInvoice.mockResolvedValue({ ...sentInvoice, ...overrides });
    const { service, stripe, client } = setup();
    await expect(
      service.markPaid(admin, sentInvoice.id, input),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(stripe.payInvoiceOutOfBand).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });
});
