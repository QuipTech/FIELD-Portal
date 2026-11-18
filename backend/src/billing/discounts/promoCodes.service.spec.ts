import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import * as termsRepository from '../accountTerms/accountTerms.repository';
import * as promoRepository from './promoCodes.repository';
import { PromoCodeRow, RedemptionRow } from './promoCodes.repository';
import { PromoCodesService } from './promoCodes.service';

jest.mock('./promoCodes.repository');
jest.mock('../accountTerms/accountTerms.repository');
jest.mock('../billingAudit/billingAudit', () => ({
  recordBillingAudit: jest.fn(),
}));

const promos = jest.mocked(promoRepository);
const terms = jest.mocked(termsRepository);
const orgAdmin = { userId: 'user-a', tenantId: 'tenant-a', email: 'a@acme.au' };
// 15 April 2026 in Brisbane.
const NOW = new Date('2026-04-15T02:00:00Z');

const code = (overrides: Partial<PromoCodeRow> = {}): PromoCodeRow => ({
  id: 'promo-1',
  code: 'SPRING25',
  description: 'Spring offer',
  discount_type: 'percent',
  discount_value: 25,
  duration_months: 3,
  valid_from: null,
  valid_until: null,
  max_redemptions: null,
  redemptions_count: 0,
  new_customers_only: false,
  active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const redemption = (overrides: Partial<RedemptionRow> = {}): RedemptionRow => ({
  id: 'red-1',
  promo_code_id: 'promo-1',
  code: 'SPRING25',
  description: 'Spring offer',
  discount_type: 'percent',
  discount_value: 25,
  duration_months: 3,
  billing_account_id: 'acct-1',
  account_name: 'Acme',
  redeemed_at: new Date(),
  starts_month: '2026-04-01',
  ends_month: '2026-06-01',
  ...overrides,
});

const setup = () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const database = {
    query: jest.fn(),
    transaction: async (work: (c: typeof client) => unknown) => work(client),
  };
  terms.findOrganisationAccountTerms.mockResolvedValue({
    id: 'acct-1',
    timezone: 'Australia/Brisbane',
  } as termsRepository.AccountTermsRow);
  promos.isNewCustomer.mockResolvedValue(true);
  promos.listRedemptionsForAccount.mockResolvedValue([]);
  promos.insertRedemption.mockResolvedValue('red-1');
  return {
    service: new PromoCodesService(
      database as unknown as ServiceDatabaseService,
    ),
    client,
  };
};

beforeEach(() => jest.clearAllMocks());

describe('redeeming a promo code', () => {
  it('redeems from the month still open for N months, under a per-account lock', async () => {
    const { service, client } = setup();
    promos.findPromoCodeByCode.mockResolvedValue(code());
    // Before redeeming: none. After: the new one.
    promos.listRedemptionsForAccount
      .mockResolvedValueOnce([])
      .mockResolvedValue([redemption()]);
    const result = await service.redeem(orgAdmin, 'spring25', NOW);
    expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(promos.findPromoCodeByCode).toHaveBeenCalledWith(
      client,
      'spring25',
      true,
    );
    expect(promos.insertRedemption).toHaveBeenCalledWith(client, {
      promoCodeId: 'promo-1',
      billingAccountId: 'acct-1',
      redeemedBy: 'user-a',
      startsMonth: '2026-04-01',
      endsMonth: '2026-06-01',
    });
    expect(result).toMatchObject({
      code: 'SPRING25',
      summary: '25% off machine charges for 3 months',
    });
  });

  it.each([
    ['invalid', undefined, {}],
    ['expired', code({ valid_until: '2026-04-14' }), {}],
    ['fully_used', code({ max_redemptions: 10, redemptions_count: 10 }), {}],
    [
      'new_customers_only',
      code({ new_customers_only: true }),
      { newCustomer: false },
    ],
    [
      'already_used',
      code(),
      { redemptions: [redemption({ ends_month: '2026-01-01' })] },
    ],
    [
      'promo_already_active',
      code(),
      { redemptions: [redemption({ promo_code_id: 'other' })] },
    ],
  ] as [
    string,
    PromoCodeRow | undefined,
    { newCustomer?: boolean; redemptions?: RedemptionRow[] },
  ][])(
    'refuses with a clear %s error and saves nothing',
    async (expected, promo, context) => {
      const { service } = setup();
      promos.findPromoCodeByCode.mockResolvedValue(promo);
      if (context.newCustomer === false)
        promos.isNewCustomer.mockResolvedValue(false);
      if (context.redemptions)
        promos.listRedemptionsForAccount.mockResolvedValue(context.redemptions);
      await expect(service.redeem(orgAdmin, 'X', NOW)).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: expected,
          message: expect.any(String),
        }),
      });
      expect(promos.insertRedemption).not.toHaveBeenCalled();
    },
  );

  it('validates without redeeming', async () => {
    const { service } = setup();
    promos.findPromoCodeByCode.mockResolvedValue(
      code({ duration_months: null }),
    );
    expect(await service.validate(orgAdmin, 'SPRING25', NOW)).toMatchObject({
      code: 'SPRING25',
      startsMonth: '2026-04-01',
      endsMonth: null,
    });
    expect(promos.insertRedemption).not.toHaveBeenCalled();
  });
});

describe('managing promo codes', () => {
  it('refuses a percentage over 100', async () => {
    const { service } = setup();
    await expect(
      service.create(orgAdmin, {
        code: 'BIG',
        description: 'x',
        discountType: 'percent',
        discountValue: 150,
        durationMonths: null,
        validFrom: null,
        validUntil: null,
        maxRedemptions: null,
        newCustomersOnly: false,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("won't change a redeemed code's discount", async () => {
    const { service } = setup();
    promos.findPromoCode.mockResolvedValue(code({ redemptions_count: 2 }));
    await expect(
      service.update(orgAdmin, 'promo-1', {
        description: 'Spring offer',
        discountType: 'percent',
        discountValue: 50,
        durationMonths: 3,
        validFrom: null,
        validUntil: null,
        maxRedemptions: null,
        newCustomersOnly: false,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(promos.updatePromoCode).not.toHaveBeenCalled();
  });
});
