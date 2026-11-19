import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import * as termsRepository from '../accountTerms/accountTerms.repository';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';
import * as repository from './statements.repository';
import { StatementsService } from './statements.service';

jest.mock('./statements.repository');
jest.mock('../accountTerms/accountTerms.repository');
jest.mock('../billingAudit/billingAudit', () => ({
  recordBillingAudit: jest.fn(),
}));

const repo = jest.mocked(repository);
const terms = jest.mocked(termsRepository);

const ADMIN = {
  userId: 'admin-1',
  tenantId: 'tenant-quiptech',
} as AuthenticatedUser;

const ACCOUNT_TERMS = {
  id: 'acct-1',
  name: 'Acme',
  payment_type: 'account',
  account_status: 'approved',
  terms_days: 30,
  default_po_number: 'PO-STANDING',
} as termsRepository.AccountTermsRow;

const statement = (
  overrides: Partial<repository.StatementRow> = {},
): repository.StatementRow => ({
  id: 'st-1',
  billing_account_id: 'acct-1',
  period_start: '2026-10-01',
  period_end: '2026-11-01',
  status: 'draft',
  reference: 'FLD-2026-10-0001',
  po_number: null,
  subtotal_ex_gst_cents: '0',
  gst_cents: '0',
  total_inc_gst_cents: '0',
  run_at: null,
  terms_days: 30,
  zoho_invoice_number: null,
  zoho_invoice_date: null,
  due_on: null,
  paid_on: null,
  paid_reference: null,
  ...overrides,
});

const charge = (amountCents: number, lineType = 'ASSET_PRO'): CalculatedLine =>
  ({
    lineType,
    description: lineType,
    quantity: 1,
    unitCents: amountCents,
    amountCents,
    calcSnapshot: {},
  }) as unknown as CalculatedLine;

const setup = (config: Record<string, unknown> = {}) => {
  const client = {} as PoolClient;
  const database = {
    query: jest.fn(),
    transaction: async (work: (c: PoolClient) => unknown) => work(client),
  };
  const notifier = {
    notifyPlatformAdmins: jest.fn(),
    emailBillingContact: jest.fn(),
    notifyAccountAdmins: jest.fn(),
  };
  const service = new StatementsService(
    database as unknown as ServiceDatabaseService,
    {
      loadConfig: async () => ({
        DEFAULT_BILLING_TIMEZONE: 'Australia/Brisbane',
        INVOICE_REMINDER_OFFSET_DAYS: [-7, 0, 7, 14],
        STATEMENT_REMINDERS_EMAIL_CLIENT: false,
        ...config,
      }),
    } as unknown as BillingConfigService,
    notifier as unknown as BillingNotifier,
  );
  return { service, client, notifier };
};

beforeEach(() => {
  jest.clearAllMocks();
  terms.findAccountTerms.mockResolvedValue(ACCOUNT_TERMS);
  repo.listStatementLines.mockResolvedValue(new Map());
  repo.findMonthLock.mockResolvedValue(undefined);
});

describe('adding charges to a statement', () => {
  it("makes the month's statement with the standing PO and terms, then totals it with GST", async () => {
    const { service, client } = setup();
    repo.isMonthLocked.mockResolvedValue(false);
    repo.lockStatementForMonth.mockResolvedValue(undefined);
    repo.insertStatement.mockResolvedValue(statement());
    repo.listStatementLines.mockResolvedValue(
      new Map([
        [
          'st-1',
          [
            { ...charge(70000), calcSnapshot: {} },
            { ...charge(-14000, 'PROMO_DISCOUNT'), calcSnapshot: {} },
          ],
        ],
      ]),
    );
    const lines = [charge(70000), charge(-14000, 'PROMO_DISCOUNT')];
    expect(
      await service.addCharges(client, null, {
        billingAccountId: 'acct-1',
        periodStart: '2026-10-01',
        lines,
        reason: 'monthly billing run',
        markRun: true,
      }),
    ).toBe('st-1');
    expect(repo.insertStatement).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        billingAccountId: 'acct-1',
        periodStart: '2026-10-01',
        periodEnd: '2026-11-01',
        poNumber: 'PO-STANDING',
        termsDays: 30,
      }),
    );
    const formatReference =
      repo.insertStatement.mock.calls[0][1].formatReference;
    expect(formatReference(7)).toBe('FLD-2026-10-0007');
    expect(repo.appendStatementLines).toHaveBeenCalledWith(
      client,
      'st-1',
      lines,
    );
    expect(repo.saveStatementTotals).toHaveBeenCalledWith(
      client,
      'st-1',
      { subtotalExGstCents: 56000, gstCents: 5600, totalIncGstCents: 61600 },
      { markRun: true },
    );
  });

  it('puts a charge for a locked month on the next open one', async () => {
    const { service, client } = setup();
    repo.isMonthLocked.mockImplementation(
      async (_db, month) => month === '2026-10-01',
    );
    repo.lockStatementForMonth.mockResolvedValue(undefined);
    repo.insertStatement.mockResolvedValue(
      statement({ id: 'st-nov', period_start: '2026-11-01' }),
    );
    await service.addCharges(client, null, {
      billingAccountId: 'acct-1',
      periodStart: '2026-10-15',
      lines: [charge(250000, 'ONBOARD_ASSISTED')],
      reason: 'assisted onboarding',
    });
    expect(repo.insertStatement.mock.calls[0][1].periodStart).toBe(
      '2026-11-01',
    );
    expect(repo.appendStatementLines.mock.calls[0][1]).toBe('st-nov');
  });

  it("adds to the month's statement while it's still a draft", async () => {
    const { service, client } = setup();
    repo.isMonthLocked.mockResolvedValue(false);
    repo.lockStatementForMonth.mockResolvedValue(statement());
    await service.addCharges(client, null, {
      billingAccountId: 'acct-1',
      periodStart: '2026-10-01',
      lines: [charge(1000)],
      reason: 'x',
    });
    expect(repo.insertStatement).not.toHaveBeenCalled();
    expect(repo.appendStatementLines.mock.calls[0][1]).toBe('st-1');
  });
});

describe('Mark month as ready', () => {
  it('locks a closed month', async () => {
    const { service } = setup();
    repo.lockMonth.mockResolvedValue({ lockedCount: 3, alreadyLocked: false });
    repo.listReportRows.mockResolvedValue([]);
    expect(
      await service.markMonthReady(
        ADMIN,
        '2026-10',
        new Date('2026-11-03T00:00:00Z'),
      ),
    ).toEqual({ month: '2026-10-01', lockedCount: 3 });
    expect(repo.lockMonth).toHaveBeenCalledWith(
      expect.anything(),
      '2026-10-01',
      'admin-1',
    );
  });

  it("refuses a month that hasn't finished", async () => {
    const { service } = setup();
    await expect(
      service.markMonthReady(
        ADMIN,
        '2026-11',
        new Date('2026-11-20T00:00:00Z'),
      ),
    ).rejects.toThrow(/hasn't finished/);
    expect(repo.lockMonth).not.toHaveBeenCalled();
  });
});

describe('tracking a statement through Zoho', () => {
  const reportWith = (row: repository.StatementRow) => {
    repo.findStatement.mockResolvedValue(row);
    repo.listReportRows.mockResolvedValue([
      {
        ...row,
        account_name: 'Acme',
        legal_name: null,
        abn: null,
        accounts_email: null,
        billing_email: 'billing@acme.test',
        payment_type: 'account',
        account_terms_days: 30,
        timezone: 'Australia/Brisbane',
      },
    ]);
  };

  it('needs the month marked ready before the Zoho number', async () => {
    const { service } = setup();
    repo.lockStatement.mockResolvedValue(statement({ status: 'draft' }));
    await expect(
      service.setZohoInvoice(ADMIN, 'st-1', {
        invoiceNumber: 'INV-000123',
        invoiceDate: '2026-11-03',
        termsDays: null,
      }),
    ).rejects.toThrow(/Mark the month as ready/);
    expect(repo.setZohoInvoice).not.toHaveBeenCalled();
  });

  it('records the Zoho number and date: invoiced_external, due the date plus terms', async () => {
    const { service } = setup();
    repo.lockStatement.mockResolvedValue(
      statement({ status: 'ready', terms_days: 30 }),
    );
    reportWith(statement({ status: 'invoiced_external' }));
    await service.setZohoInvoice(ADMIN, 'st-1', {
      invoiceNumber: 'INV-000123',
      invoiceDate: '2026-11-03',
      termsDays: null,
    });
    expect(repo.setZohoInvoice).toHaveBeenCalledWith(expect.anything(), {
      statementId: 'st-1',
      invoiceNumber: 'INV-000123',
      invoiceDate: '2026-11-03',
      termsDays: 30,
      dueOn: '2026-12-03',
      userId: 'admin-1',
    });
  });

  it('marks it paid with the date and reference, once invoiced', async () => {
    const { service } = setup();
    repo.lockStatement.mockResolvedValue(
      statement({
        status: 'invoiced_external',
        zoho_invoice_date: '2026-11-03',
      }),
    );
    reportWith(statement({ status: 'paid' }));
    await service.markPaid(ADMIN, 'st-1', {
      paidOn: '2026-11-20',
      reference: 'EFT 4411',
    });
    expect(repo.markStatementPaid).toHaveBeenCalledWith(expect.anything(), {
      statementId: 'st-1',
      paidOn: '2026-11-20',
      reference: 'EFT 4411',
      userId: 'admin-1',
    });
  });

  it("won't mark paid before the Zoho invoice is entered", async () => {
    const { service } = setup();
    repo.lockStatement.mockResolvedValue(statement({ status: 'ready' }));
    await expect(
      service.markPaid(ADMIN, 'st-1', {
        paidOn: '2026-11-20',
        reference: null,
      }),
    ).rejects.toThrow(/Zoho invoice number/);
  });
});

describe('statement reminders', () => {
  const invoiced = (dueOn: string, sent: number[] = []) => ({
    ...statement({
      status: 'invoiced_external',
      zoho_invoice_number: 'INV-000123',
      zoho_invoice_date: '2026-11-03',
      due_on: dueOn,
      total_inc_gst_cents: '61600',
    }),
    account_name: 'Acme',
    billing_email: 'billing@acme.test',
    accounts_email: 'accounts@acme.test',
    timezone: 'Australia/Brisbane',
    sent_offsets: sent,
  });

  it('goes to platform administrators only, from the Zoho due date', async () => {
    const { service, notifier } = setup();
    repo.listStatementsForReminders.mockResolvedValue([invoiced('2026-12-03')]);
    repo.recordStatementReminder.mockResolvedValue(true);
    // 10 Dec Brisbane: 7 days past the due date.
    expect(
      await service.sendDueReminders(new Date('2026-12-10T00:00:00Z')),
    ).toBe(1);
    expect(repo.recordStatementReminder).toHaveBeenCalledWith(
      expect.anything(),
      'st-1',
      7,
    );
    expect(notifier.notifyPlatformAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Zoho invoice 7 days overdue',
        body: expect.stringContaining('INV-000123'),
      }),
    );
    expect(notifier.emailBillingContact).not.toHaveBeenCalled();
    expect(notifier.notifyAccountAdmins).not.toHaveBeenCalled();
  });

  it('also emails the client when STATEMENT_REMINDERS_EMAIL_CLIENT is on', async () => {
    const { service, notifier } = setup({
      STATEMENT_REMINDERS_EMAIL_CLIENT: true,
    });
    repo.listStatementsForReminders.mockResolvedValue([invoiced('2026-12-03')]);
    repo.recordStatementReminder.mockResolvedValue(true);
    await service.sendDueReminders(new Date('2026-12-10T00:00:00Z'));
    expect(notifier.emailBillingContact).toHaveBeenCalledWith(
      'billing@acme.test',
      expect.anything(),
    );
    expect(notifier.emailBillingContact).toHaveBeenCalledWith(
      'accounts@acme.test',
      expect.anything(),
    );
  });

  it('sends nothing before the first reminder is due, or twice', async () => {
    const { service, notifier } = setup();
    repo.listStatementsForReminders.mockResolvedValue([
      invoiced('2026-12-30'),
      invoiced('2026-12-03', [7]),
    ]);
    expect(
      await service.sendDueReminders(new Date('2026-12-10T00:00:00Z')),
    ).toBe(0);
    expect(notifier.notifyPlatformAdmins).not.toHaveBeenCalled();
  });
});

describe('month-end report', () => {
  it('totals the rows and reads the figures from each statement', async () => {
    const { service } = setup();
    const base = {
      account_name: 'Acme',
      legal_name: 'Acme Mining Pty Ltd',
      abn: '12345678901',
      accounts_email: null,
      billing_email: 'billing@acme.test',
      payment_type: 'account',
      account_terms_days: 30,
      timezone: 'Australia/Brisbane',
    };
    repo.listReportRows.mockResolvedValue([
      {
        ...statement({
          subtotal_ex_gst_cents: '56000',
          gst_cents: '5600',
          total_inc_gst_cents: '61600',
        }),
        ...base,
      },
      {
        ...statement({
          id: 'st-2',
          subtotal_ex_gst_cents: '1000',
          gst_cents: '100',
          total_inc_gst_cents: '1100',
        }),
        ...base,
      },
    ]);
    repo.listStatementLines.mockResolvedValue(
      new Map([
        [
          'st-1',
          [
            {
              lineType: 'ASSET_PRO',
              description: '',
              quantity: 20,
              unitCents: 3500,
              amountCents: 70000,
              calcSnapshot: { peak: 20, bands: [] },
            },
            {
              lineType: 'PROMO_DISCOUNT',
              description: '',
              quantity: 1,
              unitCents: -14000,
              amountCents: -14000,
              calcSnapshot: { promoCode: 'SPRING' },
            },
          ],
        ],
      ]),
    );
    const report = await service.report({
      month: '2026-10-01',
      paymentType: 'account',
      status: null,
    });
    expect(report.totals).toEqual({
      subtotalExGstCents: 57000,
      gstCents: 5700,
      totalIncGstCents: 62700,
    });
    expect(report.rows[0]).toMatchObject({
      accountsEmail: 'billing@acme.test',
      peakActiveMachines: 20,
      unitPriceCents: 3500,
      machineChargeCents: 70000,
      promoCode: 'SPRING',
      promoDiscountCents: -14000,
    });
    expect(repo.listReportRows).toHaveBeenCalledWith(expect.anything(), {
      periodStart: '2026-10-01',
      paymentType: 'account',
      status: null,
    });
  });
});
