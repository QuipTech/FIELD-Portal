import {
  describePromo,
  findRedemptionProblem,
  isRedemptionCurrent,
  normaliseCode,
  PromoCodeForRedemption,
  redemptionMonths,
} from './promoCodeRules';

const code = (
  overrides: Partial<PromoCodeForRedemption> = {},
): PromoCodeForRedemption => ({
  active: true,
  validFrom: null,
  validUntil: null,
  maxRedemptions: null,
  redemptionsCount: 0,
  newCustomersOnly: false,
  ...overrides,
});

const check = (
  promo: PromoCodeForRedemption | undefined,
  overrides: Partial<Parameters<typeof findRedemptionProblem>[0]> = {},
) =>
  findRedemptionProblem({
    code: promo,
    today: '2026-04-15',
    alreadyRedeemedByAccount: false,
    accountHasActivePromo: false,
    accountIsNewCustomer: true,
    ...overrides,
  });

describe('findRedemptionProblem', () => {
  it('accepts a valid code', () => {
    expect(check(code())).toBeNull();
  });

  it('refuses an unknown or deactivated code as invalid', () => {
    expect(check(undefined)).toBe('invalid');
    expect(check(code({ active: false }))).toBe('invalid');
  });

  it('refuses a code before it starts as invalid', () => {
    expect(check(code({ validFrom: '2026-04-16' }))).toBe('invalid');
    expect(check(code({ validFrom: '2026-04-15' }))).toBeNull();
  });

  it('refuses an expired code; the last day is still valid', () => {
    expect(check(code({ validUntil: '2026-04-14' }))).toBe('expired');
    expect(check(code({ validUntil: '2026-04-15' }))).toBeNull();
  });

  it('refuses a maxed code as fully used', () => {
    expect(check(code({ maxRedemptions: 5, redemptionsCount: 5 }))).toBe(
      'fully_used',
    );
    expect(check(code({ maxRedemptions: 5, redemptionsCount: 4 }))).toBeNull();
  });

  it('refuses a new-customers-only code for an existing customer', () => {
    expect(
      check(code({ newCustomersOnly: true }), { accountIsNewCustomer: false }),
    ).toBe('new_customers_only');
    expect(
      check(code({ newCustomersOnly: false }), { accountIsNewCustomer: false }),
    ).toBeNull();
  });

  it('refuses a code this account already used', () => {
    expect(check(code(), { alreadyRedeemedByAccount: true })).toBe(
      'already_used',
    );
  });

  it('allows only one active promo per account', () => {
    expect(check(code(), { accountHasActivePromo: true })).toBe(
      'promo_already_active',
    );
  });
});

describe('redemptionMonths', () => {
  it('runs N months from the month still open', () => {
    expect(redemptionMonths('2026-04-15', 3)).toEqual({
      startsMonth: '2026-04-01',
      endsMonth: '2026-06-01',
    });
    expect(redemptionMonths('2026-11-30', 2)).toEqual({
      startsMonth: '2026-11-01',
      endsMonth: '2026-12-01',
    });
  });

  it('has no end for a forever code', () => {
    expect(redemptionMonths('2026-04-15', null).endsMonth).toBeNull();
  });
});

describe('isRedemptionCurrent', () => {
  it('is current through its last month', () => {
    expect(isRedemptionCurrent({ endsMonth: '2026-04-01' }, '2026-04-30')).toBe(
      true,
    );
    expect(isRedemptionCurrent({ endsMonth: '2026-04-01' }, '2026-05-01')).toBe(
      false,
    );
    expect(isRedemptionCurrent({ endsMonth: null }, '2030-01-01')).toBe(true);
  });
});

describe('normaliseCode and describePromo', () => {
  it('treats codes case-insensitively', () => {
    expect(normaliseCode('  spring25 ')).toBe('SPRING25');
  });

  it('describes a promo for the customer', () => {
    expect(
      describePromo({
        discountType: 'percent',
        discountValue: 20,
        durationMonths: 3,
      }),
    ).toBe('20% off machine charges for 3 months');
    expect(
      describePromo({
        discountType: 'fixed_cents',
        discountValue: 5000,
        durationMonths: null,
      }),
    ).toBe('A$50.00 off machine charges every month');
    expect(
      describePromo({
        discountType: 'fixed_cents',
        discountValue: 5000,
        durationMonths: 6,
      }),
    ).toBe('A$50.00 off machine charges a month for 6 months');
  });
});
