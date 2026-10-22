import { ConflictException } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { InvoicesService } from '../invoices/invoices.service';
import { InvoiceReviewService } from './invoiceReview.service';
import * as runInvoicesRepository from './runInvoices.repository';

jest.mock('./runInvoices.repository', () => ({
  listInvoicesDueForFinalisation: jest.fn(),
  holdRunInvoice: jest.fn(),
  releaseRunInvoice: jest.fn(),
}));

const admin = { userId: 'admin-1', tenantId: 'tenant-q', email: 'a@q.au' };

const setup = () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const database = {
    query: jest.fn(),
    transaction: async (work: (input: typeof client) => unknown) =>
      work(client),
  };
  const accounts = {
    requireAccount: jest
      .fn()
      .mockResolvedValue({ billing_email: 'accounts@acme.au' }),
  };
  const invoices = {
    getInvoice: jest
      .fn()
      .mockImplementation(async (id: string) => ({
        id,
        billingAccountId: 'acct-1',
      })),
    finaliseInvoice: jest.fn().mockResolvedValue({}),
  };
  const service = new InvoiceReviewService(
    database as unknown as ServiceDatabaseService,
    accounts as unknown as BillingAccountsService,
    invoices as unknown as InvoicesService,
  );
  return { service, client, invoices };
};

beforeEach(() => jest.clearAllMocks());

describe('monthly invoice review window', () => {
  it('finalises every due draft and emails its billing contact', async () => {
    const { service, invoices } = setup();
    jest
      .mocked(runInvoicesRepository.listInvoicesDueForFinalisation)
      .mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);
    expect(await service.finaliseDueInvoices(new Date())).toEqual([
      'inv-1',
      'inv-2',
    ]);
    expect(invoices.finaliseInvoice).toHaveBeenCalledWith(
      'inv-1',
      'accounts@acme.au',
    );
  });

  it('keeps going when one invoice fails, leaving it for the next run', async () => {
    const { service, invoices } = setup();
    jest
      .mocked(runInvoicesRepository.listInvoicesDueForFinalisation)
      .mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);
    invoices.finaliseInvoice.mockRejectedValueOnce(new Error('Stripe down'));
    expect(await service.finaliseDueInvoices(new Date())).toEqual(['inv-2']);
  });

  it('holds a draft in review and audits who held it and why', async () => {
    const { service, client } = setup();
    jest
      .mocked(runInvoicesRepository.holdRunInvoice)
      .mockResolvedValue({ billing_account_id: 'acct-1' });
    await service.holdInvoice(admin, 'inv-1', 'Peak looks wrong');
    expect(runInvoicesRepository.holdRunInvoice).toHaveBeenCalledWith(client, {
      invoiceId: 'inv-1',
      heldBy: 'admin-1',
      reason: 'Peak looks wrong',
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('billing.record_audit_entry'),
      expect.any(Array),
    );
  });

  it('refuses to hold an invoice that is not a draft in review', async () => {
    const { service } = setup();
    jest
      .mocked(runInvoicesRepository.holdRunInvoice)
      .mockResolvedValue(undefined);
    await expect(
      service.holdInvoice(admin, 'inv-1', 'Too late'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to release an invoice that is not on hold', async () => {
    const { service } = setup();
    jest
      .mocked(runInvoicesRepository.releaseRunInvoice)
      .mockResolvedValue(undefined);
    await expect(service.releaseInvoice(admin, 'inv-1', null)).rejects.toThrow(
      'not on hold',
    );
  });
});
