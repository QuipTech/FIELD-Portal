import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { BillingConfigService } from '../billingConfig/billingConfig.service';
import * as termsRepository from '../accountTerms/accountTerms.repository';
import { DiscountService } from '../discounts/discount.service';
import * as promoRepository from '../discounts/promoCodes.repository';
import { PriceBooksService } from '../priceBooks/priceBooks.service';
import { ASSET_PRO_V1 } from '../pricing/priceBookV1Fixture';
import * as countsRepository from './dailyBillableCounts.repository';
import { MonthlyRunService } from './monthlyRun.service';
import * as runInvoicesRepository from './runInvoices.repository';
import { StatementsService } from '../statements/statements.service';

jest.mock('./dailyBillableCounts.repository');
jest.mock('./runInvoices.repository');
jest.mock('../accountTerms/accountTerms.repository');
jest.mock('../discounts/promoCodes.repository');
jest.mock('../billingAudit/billingAudit', () => ({
  recordBillingAudit: jest.fn(),
}));

const counts = jest.mocked(countsRepository);
const runInvoices = jest.mocked(runInvoicesRepository);
const terms = jest.mocked(termsRepository);
const promos = jest.mocked(promoRepository);

const ACCOUNT: countsRepository.RunAccountRow = {
  id: 'acct-1',
  timezone: 'Australia/Brisbane',
  payment_type: 'card',
  account_status: 'none',
};
const ZOHO_ACCOUNT: countsRepository.RunAccountRow = {
  ...ACCOUNT,
  payment_type: 'account',
  account_status: 'approved',
};
// 1 May 2026, 10am Brisbane: April has closed.
const NOW = new Date('2026-05-01T00:00:00Z');

// 20 machines all April → A$700.00 (T9's peak), 2 TECH seats.
const aprilCounts = () =>
  Array.from({ length: 30 }, (_, index) => ({
    day: `2026-04-${String(index + 1).padStart(2, '0')}`,
    activeMachines: 20,
    techSeats: 2,
  }));

const setup = (requireUserSubscription = false) => {
  counts.listBillableIntervals.mockResolvedValue({
    machines: [],
    seats: [],
  } as never);
  counts.listDailyCounts.mockResolvedValue(aprilCounts());
  runInvoices.hasRunInvoice.mockResolvedValue(false);
  runInvoices.listFinalChargedIntervals.mockResolvedValue([]);
  runInvoices.insertRunInvoice.mockResolvedValue('inv-april');
  runInvoices.listSubscriptionsForPeriod.mockResolvedValue([
    {
      id: 'sub-asset',
      plan_code: 'ASSET_PRO',
      term: 'monthly',
      committed_qty: null,
      annual_months_charged: null,
      price_book_id: 'book-asset',
    },
    {
      id: 'sub-tech',
      plan_code: 'TECH',
      term: 'monthly',
      committed_qty: null,
      annual_months_charged: null,
      price_book_id: 'book-tech',
    },
  ]);
  terms.findAccountTerms.mockResolvedValue(undefined);
  promos.listRedemptionsForAccount.mockResolvedValue([]);
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const database = {
    transaction: async (work: (c: typeof client) => unknown) => work(client),
  };
  const books = {
    getPinnedPriceBook: jest.fn(async (id: string) =>
      id === 'book-tech'
        ? {
            id,
            planCode: 'TECH',
            version: 1,
            effectiveFrom: '2026-01-01',
            unitCents: 4900,
            minimumAnnualCents: null,
            bands: [],
          }
        : ASSET_PRO_V1,
    ),
  };
  const statements = {
    addCharges: jest.fn().mockResolvedValue('statement-april'),
  };
  const service = new MonthlyRunService(
    database as unknown as ServiceDatabaseService,
    {
      loadConfig: async () => ({
        INVOICE_REVIEW_HOURS: 24,
        REQUIRE_USER_SUBSCRIPTION: requireUserSubscription,
      }),
    } as unknown as BillingConfigService,
    books as unknown as PriceBooksService,
    new DiscountService(),
    statements as unknown as StatementsService,
  );
  return { service, statements, client };
};

const insertedInvoice = () => runInvoices.insertRunInvoice.mock.calls[0][1];

beforeEach(() => jest.clearAllMocks());

describe('monthly run', () => {
  describe('a 30-day account (invoiced in Zoho)', () => {
    it('writes the month to its statement with the same lines, never an invoice', async () => {
      const { service, statements } = setup();
      promos.listRedemptionsForAccount.mockResolvedValue([]);
      terms.findAccountTerms.mockResolvedValue({
        free_until: '2026-04-30',
        free_percent: 50,
      } as termsRepository.AccountTermsRow);
      expect(await service.runAccount(ZOHO_ACCOUNT, NOW)).toBe(
        'statement-april',
      );
      expect(runInvoices.insertRunInvoice).not.toHaveBeenCalled();
      expect(runInvoices.markNoCharge).not.toHaveBeenCalled();
      const [, actor, params] = statements.addCharges.mock.calls[0];
      expect(actor).toBeNull();
      expect(params).toMatchObject({
        billingAccountId: 'acct-1',
        periodStart: '2026-04-01',
        markRun: true,
      });
      expect(
        params.lines.map((line: { lineType: string; amountCents: number }) => [
          line.lineType,
          line.amountCents,
        ]),
      ).toEqual([
        ['ASSET_PRO', 70000],
        ['FREE_PERIOD_DISCOUNT', -35000],
      ]);
    });

    it('skips a month its statement already has from the run', async () => {
      const { service, statements, client } = setup();
      client.query.mockImplementation(async (sql: string) =>
        sql.includes('run_at IS NOT NULL')
          ? { rows: [{ found: true }] }
          : { rows: [] },
      );
      expect(await service.runAccount(ZOHO_ACCOUNT, NOW)).toBeNull();
      expect(statements.addCharges).not.toHaveBeenCalled();
    });
  });

  it('bills active machines only when there is no user paywall', async () => {
    const { service } = setup(false);
    await service.runAccount(ACCOUNT, NOW);
    const invoice = insertedInvoice();
    expect(invoice.lines.map((line) => line.lineType)).toEqual(['ASSET_PRO']);
    expect(invoice.totalExGstCents).toBe(70000);
    expect(runInvoices.markNoCharge).not.toHaveBeenCalled();
  });

  it('still bills TECH seats when REQUIRE_USER_SUBSCRIPTION is on', async () => {
    const { service } = setup(true);
    await service.runAccount(ACCOUNT, NOW);
    expect(insertedInvoice().lines.map((line) => line.lineType)).toEqual([
      'ASSET_PRO',
      'TECH',
    ]);
  });

  it('records a free month at A$0 with its discount line and never sends it', async () => {
    const { service } = setup();
    terms.findAccountTerms.mockResolvedValue({
      free_until: '2026-04-15',
      free_percent: 100,
    } as termsRepository.AccountTermsRow);
    await service.runAccount(ACCOUNT, NOW);
    const invoice = insertedInvoice();
    expect(
      invoice.lines.map((line) => [line.lineType, line.amountCents]),
    ).toEqual([
      ['ASSET_PRO', 70000],
      ['FREE_PERIOD_DISCOUNT', -70000],
    ]);
    expect(invoice.totalExGstCents).toBe(0);
    expect(invoice.reviewUntil).toBeNull();
    expect(runInvoices.markNoCharge).toHaveBeenCalledWith(
      expect.anything(),
      'inv-april',
      'fully_discounted',
    );
  });

  it('bills normally the month after the free period, with no back billing', async () => {
    const { service } = setup();
    terms.findAccountTerms.mockResolvedValue({
      free_until: '2026-03-31',
      free_percent: 100,
    } as termsRepository.AccountTermsRow);
    await service.runAccount(ACCOUNT, NOW);
    expect(insertedInvoice().totalExGstCents).toBe(70000);
    expect(insertedInvoice().lines).toHaveLength(1);
  });

  it('applies a promo for the month as a negative line', async () => {
    const { service } = setup();
    promos.listRedemptionsForAccount.mockResolvedValue([
      {
        id: 'red-1',
        promo_code_id: 'promo-1',
        code: 'WELCOME',
        description: 'Welcome',
        discount_type: 'fixed_cents',
        discount_value: 10000,
        duration_months: 3,
        billing_account_id: 'acct-1',
        account_name: 'Acme',
        redeemed_at: new Date(),
        starts_month: '2026-04-01',
        ends_month: '2026-06-01',
      },
    ]);
    await service.runAccount(ACCOUNT, NOW);
    expect(insertedInvoice().totalExGstCents).toBe(60000);
    expect(insertedInvoice().lines[1]).toMatchObject({
      lineType: 'PROMO_DISCOUNT',
      amountCents: -10000,
    });
  });
});
