import { BillingAccountsService } from '../billingAccounts/billingAccounts.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import { createRecordingDatabase } from '../billingRecordingDatabase';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { ASSET_PRO_V1 } from '../pricing/priceBookV1Fixture';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { BillingSignUpService } from './billingSignUp.service';

const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const actor = { userId: 'user-1', tenantId: 'tenant-1' };

const subscriptionRow = (params: unknown[]) => ({
  id: 'sub-1',
  billing_account_id: params[0],
  plan_code: params[1],
  price_book_id: params[2],
  term: params[3],
  committed_qty: params[4],
  annual_months_charged: params[5],
  contract_annual_cents: null,
  status: 'active',
  started_at: new Date('2026-04-16T00:00:00Z'),
  current_period_start: new Date(`${params[7] as string}T00:00:00`),
  current_period_end: new Date(`${params[8] as string}T00:00:00`),
  cancel_at: null,
  export_until: null,
  delete_after: null,
});

const setUp = () => {
  const database = createRecordingDatabase((sql, params) => {
    if (sql.includes('admin_create_billing_account'))
      return [{ id: ACCOUNT_ID }];
    if (sql.includes('INSERT INTO billing.subscriptions'))
      return [subscriptionRow(params)];
    return undefined;
  });
  const config = {
    loadConfig: async () => ({
      DEFAULT_BILLING_TIMEZONE: 'Australia/Brisbane',
      ANNUAL_MONTHS_CHARGED: 10,
    }),
  } as unknown as BillingConfigService;
  const priceBooks = {
    getPriceBookInEffect: async () => ASSET_PRO_V1,
  } as unknown as PriceBooksService;
  const accounts = {
    requireAccount: async () => ({ id: ACCOUNT_ID }),
    ensureStripeCustomer: async () => ({}),
  } as unknown as BillingAccountsService;
  const subscriptions = new SubscriptionsService(
    database.serviceDatabase,
    config,
    priceBooks,
  );
  const service = new BillingSignUpService(
    database.serviceDatabase,
    config,
    accounts,
    subscriptions,
  );
  return { database, service };
};

const input = {
  organisationId: 'tenant-1',
  name: 'Acme Mining Pty Ltd',
  abn: '51824753556',
  billingEmail: 'accounts@acme.example',
  timezone: null,
  choice: { term: 'monthly' as const },
};

describe('BillingSignUpService', () => {
  it('T22: a new customer starts on monthly ASSET_PRO immediately, with no trial or pilot record', async () => {
    const { database, service } = setUp();
    const now = new Date('2026-04-16T02:00:00Z');

    const result = await service.signUp(actor, input, now);

    expect(result.subscription).toMatchObject({
      planCode: 'ASSET_PRO',
      term: 'monthly',
      status: 'active',
      priceBookId: ASSET_PRO_V1.id,
      currentPeriodStart: '2026-04-01',
      currentPeriodEnd: '2026-05-01',
      committedQty: null,
    });
    const subscriptionInserts = database
      .writes()
      .filter((entry) => entry.sql.includes('billing.subscriptions'));
    expect(subscriptionInserts).toHaveLength(1);
    const everyParam = database.queries.flatMap((entry) => entry.params);
    expect(everyParam).not.toContain('pilot');
    expect(everyParam).not.toContain('trial');
  });

  it('uses the configured default time zone when none is given', async () => {
    const { database, service } = setUp();
    await service.signUp(actor, input);
    const create = database.queries.find((entry) =>
      entry.sql.includes('admin_create_billing_account'),
    );
    expect(create?.params[4]).toBe('Australia/Brisbane');
  });

  it('audits the account and the subscription in the same transaction', async () => {
    const { database, service } = setUp();
    await service.signUp(actor, input);
    const audits = database.queries.filter((entry) =>
      entry.sql.includes('billing.record_audit_entry'),
    );
    expect(audits.map((entry) => entry.params[3])).toEqual([
      'billing_account',
      'billing_subscription',
    ]);
  });

  it('pins an annual commitment when the customer chooses annual', async () => {
    const { service } = setUp();
    const result = await service.signUp(
      actor,
      { ...input, choice: { term: 'annual', committedQty: 15 } },
      new Date('2026-04-16T02:00:00Z'),
    );
    expect(result.subscription).toMatchObject({
      term: 'annual',
      committedQty: 15,
      annualMonthsCharged: 10,
      currentPeriodStart: '2026-04-16',
      currentPeriodEnd: '2027-04-16',
    });
  });
});
