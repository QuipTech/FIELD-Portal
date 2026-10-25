import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { findInvoice } from '../invoices/invoices.repository';
import { PersonalPaymentCheckService } from '../personalSubscription/personalPaymentCheck.service';
import { AdminInvoicesService } from './adminInvoices.service';
import {
  findInvoicesToReconcile,
  listAdminInvoices,
  summariseAdminInvoices,
} from './adminInvoices.repository';

jest.mock('../invoices/invoices.repository', () => ({
  findInvoice: jest.fn(),
}));
jest.mock('./adminInvoices.repository', () => ({
  listAdminInvoices: jest.fn(),
  summariseAdminInvoices: jest.fn(),
  findInvoicesToReconcile: jest.fn(),
}));

const setup = () => {
  const paymentCheck = { reconcileInvoice: jest.fn() };
  const service = new AdminInvoicesService(
    {} as ServiceDatabaseService,
    paymentCheck as unknown as PersonalPaymentCheckService,
  );
  return { service, paymentCheck };
};

beforeEach(() => jest.clearAllMocks());

describe('admin invoices', () => {
  it('lists invoices with payer details and a summary for every category', async () => {
    const { service } = setup();
    jest.mocked(listAdminInvoices).mockResolvedValue({
      total: 1,
      rows: [
        {
          id: 'invoice-a',
          category: 'unpaid',
          status: 'synced',
          kind: 'personal',
          payer_email: 'a@example.com',
          payer_name: 'Ann Lee',
          organisation_name: null,
          billing_account_name: 'Ann Lee (personal)',
          period_start: '2026-10-01',
          total_ex_gst_cents: '4900',
          gst_cents: '490',
          total_cents: '5390',
          amount_paid_cents: '0',
          amount_refunded_cents: '0',
          stripe_invoice_id: 'in_a',
          hosted_invoice_url: null,
          created_at: new Date(0),
          updated_at: new Date(0),
        },
      ],
    });
    jest.mocked(summariseAdminInvoices).mockResolvedValue([
      {
        category: 'unpaid',
        count: '1',
        total_cents: '5390',
        paid_cents: '0',
      },
    ]);
    const result = await service.list({
      page: 2,
      pageSize: 10,
      category: 'unpaid',
      search: '  ann ',
    });
    expect(listAdminInvoices).toHaveBeenCalledWith(expect.anything(), {
      category: 'unpaid',
      search: 'ann',
      limit: 10,
      offset: 10,
    });
    expect(result.items[0]).toMatchObject({
      payerEmail: 'a@example.com',
      organisationName: 'Ann Lee (personal)',
      totalCents: 5390,
      gstCents: 490,
    });
    expect(result.summary.unpaid).toEqual({
      count: 1,
      totalCents: 5390,
      paidCents: 0,
    });
    expect(result.summary.paid).toEqual({
      count: 0,
      totalCents: 0,
      paidCents: 0,
    });
  });

  it('records Stripe payments and keeps going when one invoice fails', async () => {
    const { service, paymentCheck } = setup();
    jest.mocked(findInvoicesToReconcile).mockResolvedValue(['a', 'b', 'c']);
    jest
      .mocked(findInvoice)
      .mockImplementation(
        async (_database, id) =>
          ({ id }) as Awaited<ReturnType<typeof findInvoice>>,
      );
    paymentCheck.reconcileInvoice
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('Stripe down'))
      .mockResolvedValueOnce(false);
    expect(await service.refreshFromStripe()).toEqual({
      checked: 3,
      updated: 1,
      failed: 1,
    });
    expect(paymentCheck.reconcileInvoice).toHaveBeenCalledTimes(3);
  });
});
