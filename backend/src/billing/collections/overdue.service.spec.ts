import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import * as collectionsRepository from './collections.repository';
import { ReminderInvoiceRow } from './collections.repository';
import { OverdueService } from './overdue.service';

jest.mock('./collections.repository');
const repo = jest.mocked(collectionsRepository);

const invoice = (
  overrides: Partial<ReminderInvoiceRow> = {},
): ReminderInvoiceRow => ({
  id: 'inv-1',
  billing_account_id: 'acct-1',
  account_name: 'Acme Mining',
  billing_email: 'billing@acme.au',
  accounts_email: 'accounts@acme.au',
  timezone: 'Australia/Brisbane',
  due_on: '2026-11-25',
  collection_method: 'send_invoice',
  outstanding_cents: '77000',
  hosted_invoice_url: 'https://invoice.stripe.com/i/1',
  sent_offsets: [],
  ...overrides,
});

const setup = (offsets = [-7, 0, 7, 14]) => {
  const notifier = {
    emailBillingContact: jest.fn(),
    notifyAccountAdmins: jest.fn(),
    notifyPlatformAdmins: jest.fn(),
  };
  const service = new OverdueService(
    {} as ServiceDatabaseService,
    {
      loadConfig: async () => ({ INVOICE_REMINDER_OFFSET_DAYS: offsets }),
    } as unknown as BillingConfigService,
    notifier as unknown as BillingNotifier,
  );
  return { service, notifier };
};

// 18 November 2026, 10am in Brisbane.
const NOW = new Date('2026-11-18T00:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  repo.recordReminderSent.mockResolvedValue(true);
});

describe('payment reminders', () => {
  it('sends the 7-days-before reminder to the contact, accounts email and admins', async () => {
    repo.listInvoicesForReminders.mockResolvedValue([invoice()]);
    const { service, notifier } = setup();
    expect(await service.sendDueNotices(NOW)).toBe(1);
    expect(repo.listInvoicesForReminders).toHaveBeenCalledWith(
      expect.anything(),
      7,
    );
    expect(repo.recordReminderSent).toHaveBeenCalledWith(expect.anything(), {
      invoiceId: 'inv-1',
      billingAccountId: 'acct-1',
      offsetDays: -7,
    });
    expect(notifier.emailBillingContact).toHaveBeenCalledWith(
      'billing@acme.au',
      expect.objectContaining({ title: 'Invoice due soon' }),
    );
    expect(notifier.emailBillingContact).toHaveBeenCalledWith(
      'accounts@acme.au',
      expect.anything(),
    );
    expect(notifier.notifyAccountAdmins).toHaveBeenCalledWith(
      'acct-1',
      expect.anything(),
    );
  });

  it('sends the 14-days-overdue reminder', async () => {
    repo.listInvoicesForReminders.mockResolvedValue([
      invoice({ due_on: '2026-11-04', sent_offsets: [-7, 0, 7] }),
    ]);
    const { service, notifier } = setup();
    await service.sendDueNotices(NOW);
    expect(notifier.notifyAccountAdmins).toHaveBeenCalledWith(
      'acct-1',
      expect.objectContaining({ title: 'Invoice 14 days overdue' }),
    );
  });

  it('sends each reminder once, even when another container got there first', async () => {
    repo.listInvoicesForReminders.mockResolvedValue([invoice()]);
    repo.recordReminderSent.mockResolvedValue(false);
    const { service, notifier } = setup();
    expect(await service.sendDueNotices(NOW)).toBe(0);
    expect(notifier.emailBillingContact).not.toHaveBeenCalled();
  });

  it('never suspends an account by itself', async () => {
    repo.listInvoicesForReminders.mockResolvedValue([
      invoice({ due_on: '2026-09-01', sent_offsets: [-7, 0, 7, 14] }),
    ]);
    const { service } = setup();
    await service.sendDueNotices(NOW);
    expect(repo.setSuspension).not.toHaveBeenCalled();
  });

  it('sends nothing when no offsets are configured', async () => {
    const { service } = setup([]);
    expect(await service.sendDueNotices(NOW)).toBe(0);
    expect(repo.listInvoicesForReminders).not.toHaveBeenCalled();
  });
});

describe('credit limit', () => {
  it('warns platform admins once when the unpaid balance goes over the limit', async () => {
    repo.listCreditLimitAccounts.mockResolvedValue([
      {
        id: 'acct-1',
        name: 'Acme Mining',
        credit_limit_cents: '100000',
        credit_limit_warned_at: null,
        unpaid_cents: '150000',
      },
    ]);
    repo.setCreditLimitWarned.mockResolvedValue(true);
    const { service, notifier } = setup();
    expect(await service.checkCreditLimits()).toBe(1);
    expect(repo.setCreditLimitWarned).toHaveBeenCalledWith(
      expect.anything(),
      'acct-1',
      true,
    );
    expect(notifier.notifyPlatformAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Credit limit exceeded',
        body: expect.stringContaining('Nothing has been blocked'),
      }),
    );
    expect(repo.setSuspension).not.toHaveBeenCalled();
  });

  it('clears the warning quietly once the balance is back under', async () => {
    repo.listCreditLimitAccounts.mockResolvedValue([
      {
        id: 'acct-1',
        name: 'Acme Mining',
        credit_limit_cents: '100000',
        credit_limit_warned_at: new Date(),
        unpaid_cents: '20000',
      },
    ]);
    repo.setCreditLimitWarned.mockResolvedValue(true);
    const { service, notifier } = setup();
    expect(await service.checkCreditLimits()).toBe(0);
    expect(repo.setCreditLimitWarned).toHaveBeenCalledWith(
      expect.anything(),
      'acct-1',
      false,
    );
    expect(notifier.notifyPlatformAdmins).not.toHaveBeenCalled();
  });
});
