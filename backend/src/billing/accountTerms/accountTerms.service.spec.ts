import { ConflictException } from '@nestjs/common';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { BillingNotifier } from '../billingNotices/billingNotifier.service';
import * as termsRepository from './accountTerms.repository';
import { AccountTermsRow } from './accountTerms.repository';
import { AccountTermsService } from './accountTerms.service';

jest.mock('./accountTerms.repository');
jest.mock('../billingAudit/billingAudit', () => ({
  recordBillingAudit: jest.fn(),
}));

const repo = jest.mocked(termsRepository);
const audit = jest.mocked(recordBillingAudit);

const orgAdmin = {
  userId: 'user-admin',
  tenantId: 'tenant-a',
  email: 'a@acme.au',
};
const superAdmin = {
  userId: 'user-q',
  tenantId: 'tenant-q',
  email: 'q@quiptech.au',
};

const baseRow = (
  overrides: Partial<AccountTermsRow> = {},
): AccountTermsRow => ({
  id: 'acct-1',
  name: 'Acme Mining',
  abn: null,
  billing_email: 'billing@acme.au',
  timezone: 'Australia/Brisbane',
  payment_type: 'card',
  account_status: 'none',
  terms_days: 30,
  credit_limit_cents: null,
  po_required: false,
  default_po_number: null,
  account_legal_name: null,
  accounts_email: null,
  accounts_phone: null,
  application_notes: null,
  applied_at: null,
  approved_at: null,
  approval_notes: null,
  rejected_at: null,
  rejected_reason: null,
  free_until: null,
  free_percent: 100,
  free_reason: null,
  free_set_at: null,
  ...overrides,
});

const application = {
  legalName: 'Acme Mining Pty Ltd',
  abn: '12345678901',
  accountsEmail: 'accounts@acme.au',
  accountsPhone: '07 3000 0000',
  poRequired: true,
  notes: null,
};

// The repository mock keeps one row in memory and applies each change to
// it, the way the real UPDATE would.
let row: AccountTermsRow;

const setup = () => {
  repo.findOrganisationAccountTerms.mockImplementation(async () => row);
  repo.lockAccountTerms.mockImplementation(async () => ({ ...row }));
  repo.updateAccountTerms.mockImplementation(async (_client, _id, change) => {
    const now = new Date('2026-11-18T00:00:00Z');
    const applied = Object.fromEntries(
      Object.entries(change).map(([key, value]) => [
        key,
        value === 'now' ? now : value,
      ]),
    );
    row = { ...row, ...applied } as AccountTermsRow;
  });
  const notifier = {
    notifyAccountAdmins: jest.fn(),
    notifyPlatformAdmins: jest.fn(),
    emailBillingContact: jest.fn(),
  };
  const database = {
    transaction: async (work: (client: unknown) => unknown) => work({}),
  };
  const service = new AccountTermsService(
    database as unknown as ServiceDatabaseService,
    {
      loadConfig: async () => ({ ACCOUNT_DEFAULT_TERMS_DAYS: 30 }),
    } as unknown as BillingConfigService,
    notifier as unknown as BillingNotifier,
  );
  return { service, notifier };
};

beforeEach(() => {
  jest.clearAllMocks();
  row = baseRow();
});

describe('30-day account application', () => {
  it('applies: pending, details saved, platform admins told, audited', async () => {
    const { service, notifier } = setup();
    const terms = await service.apply(orgAdmin, application);
    expect(terms).toMatchObject({
      accountStatus: 'pending',
      paymentType: 'card',
      usesAccountTerms: false,
      poRequired: true,
      application: { legalName: 'Acme Mining Pty Ltd', abn: '12345678901' },
    });
    expect(notifier.notifyPlatformAdmins).toHaveBeenCalledWith(
      expect.objectContaining({ title: '30-day account application' }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      orgAdmin,
      expect.objectContaining({
        entityType: 'billing_account',
        from: expect.objectContaining({ accountStatus: 'none' }),
        to: expect.objectContaining({ accountStatus: 'pending' }),
      }),
    );
  });

  it('refuses a second application while one is pending, and once approved', async () => {
    const { service } = setup();
    row = baseRow({ account_status: 'pending' });
    await expect(service.apply(orgAdmin, application)).rejects.toBeInstanceOf(
      ConflictException,
    );
    row = baseRow({ payment_type: 'account', account_status: 'approved' });
    await expect(service.apply(orgAdmin, application)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repo.updateAccountTerms).not.toHaveBeenCalled();
  });

  it('lets a rejected organisation apply again', async () => {
    const { service } = setup();
    row = baseRow({ account_status: 'rejected', rejected_reason: 'No ABN' });
    expect(await service.apply(orgAdmin, application)).toMatchObject({
      accountStatus: 'pending',
      application: { rejectedReason: null },
    });
  });

  it('approves with the default 30 days and a credit limit; the organisation is told', async () => {
    const { service, notifier } = setup();
    row = baseRow({
      account_status: 'pending',
      accounts_email: 'accounts@acme.au',
    });
    const terms = await service.approve(superAdmin, 'acct-1', {
      termsDays: null,
      creditLimitCents: 500000,
      notes: 'Good history',
    });
    expect(terms).toMatchObject({
      paymentType: 'account',
      accountStatus: 'approved',
      usesAccountTerms: true,
      termsDays: 30,
      creditLimitCents: 500000,
    });
    expect(notifier.notifyAccountAdmins).toHaveBeenCalledWith(
      'acct-1',
      expect.objectContaining({ title: '30-day account approved' }),
    );
    expect(notifier.emailBillingContact).toHaveBeenCalledWith(
      'accounts@acme.au',
      expect.objectContaining({ title: '30-day account approved' }),
    );
  });

  it('rejects with a reason, stays on card and asks for a card', async () => {
    const { service, notifier } = setup();
    row = baseRow({ account_status: 'pending' });
    const terms = await service.reject(
      superAdmin,
      'acct-1',
      'Trading history too short.',
    );
    expect(terms).toMatchObject({
      paymentType: 'card',
      accountStatus: 'rejected',
      application: { rejectedReason: 'Trading history too short.' },
    });
    expect(notifier.notifyAccountAdmins).toHaveBeenCalledWith(
      'acct-1',
      expect.objectContaining({
        title: '30-day account not approved',
        body: expect.stringContaining('add a card'),
      }),
    );
  });

  it('only decides applications that are pending or on hold', async () => {
    const { service } = setup();
    row = baseRow({ account_status: 'none' });
    await expect(
      service.approve(superAdmin, 'acct-1', {
        termsDays: null,
        creditLimitCents: null,
        notes: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.reject(superAdmin, 'acct-1', 'x'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('switches card ↔ account at any time with a reason, audited', async () => {
    const { service } = setup();
    const toAccount = await service.setPaymentTerms(superAdmin, 'acct-1', {
      paymentType: 'account',
      termsDays: 45,
      creditLimitCents: null,
      poRequired: null,
      reason: 'Enterprise customer',
    });
    expect(toAccount).toMatchObject({
      paymentType: 'account',
      accountStatus: 'approved',
      termsDays: 45,
    });
    const toCard = await service.setPaymentTerms(superAdmin, 'acct-1', {
      paymentType: 'card',
      termsDays: null,
      creditLimitCents: null,
      poRequired: null,
      reason: 'Repeatedly late',
    });
    expect(toCard).toMatchObject({
      paymentType: 'card',
      usesAccountTerms: false,
    });
    expect(audit).toHaveBeenLastCalledWith(
      expect.anything(),
      superAdmin,
      expect.objectContaining({ reason: 'Repeatedly late' }),
    );
  });

  it('withdraws an undecided application when the organisation chooses card', async () => {
    const { service } = setup();
    row = baseRow({ account_status: 'pending' });
    expect(await service.chooseCard(orgAdmin)).toMatchObject({
      paymentType: 'card',
      accountStatus: 'none',
    });
  });
});
