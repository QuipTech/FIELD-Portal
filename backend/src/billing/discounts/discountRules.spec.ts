import { recalculateLineAmountCents } from '../monthlyRun/monthlyLineCalculation';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';
import {
  calculateDiscountLines,
  FreePeriodTerms,
  isFreePeriodActiveForMonth,
  isPromoActiveForMonth,
  PromoTerms,
} from './discountRules';

const APRIL = '2026-04-01';

const assetPro = (
  amountCents: number,
  lineType = 'ASSET_PRO',
): CalculatedLine => ({
  lineType,
  description: 'machines',
  quantity: 1,
  unitCents: amountCents,
  amountCents,
  calcSnapshot: {
    formula: 'ASSET_PRO',
    subscriptionId: 'sub-1',
    periodStart: APRIL,
    periodEnd: '2026-05-01',
    peak: 20,
    peakDay: '2026-04-21',
    priceBookId: 'book-1',
    priceBookVersion: 1,
    bands: [],
    seatCents: null,
    committedQty: null,
    monthsCharged: null,
  },
});

const promo = (overrides: Partial<PromoTerms> = {}): PromoTerms => ({
  redemptionId: 'red-1',
  promoCodeId: 'promo-1',
  code: 'SPRING',
  discountType: 'percent',
  discountValue: 20,
  startsMonth: APRIL,
  endsMonth: null,
  ...overrides,
});

const free = (overrides: Partial<FreePeriodTerms> = {}): FreePeriodTerms => ({
  freeUntil: '2026-04-30',
  percent: 100,
  ...overrides,
});

const total = (lines: CalculatedLine[]) =>
  lines.reduce((sum, line) => sum + line.amountCents, 0);

describe('calculateDiscountLines', () => {
  it('makes a whole month free: total A$0', () => {
    const lines = [assetPro(70000)];
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines,
      freePeriod: free(),
      promo: null,
    });
    expect(discounts).toHaveLength(1);
    expect(discounts[0]).toMatchObject({
      lineType: 'FREE_PERIOD_DISCOUNT',
      quantity: 1,
      unitCents: -70000,
      amountCents: -70000,
    });
    expect(total([...lines, ...discounts])).toBe(0);
  });

  it('frees the whole month containing free_until, then bills the next', () => {
    expect(isFreePeriodActiveForMonth('2026-04-10', APRIL)).toBe(true);
    expect(isFreePeriodActiveForMonth('2026-04-10', '2026-05-01')).toBe(false);
    expect(isFreePeriodActiveForMonth('2026-03-31', APRIL)).toBe(false);
    expect(isFreePeriodActiveForMonth(null, APRIL)).toBe(false);
  });

  it('applies a partial free period percentage, rounded half-up', () => {
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines: [assetPro(2901)],
      freePeriod: free({ percent: 50 }),
      promo: null,
    });
    // 1450.5 → 1451
    expect(discounts[0].amountCents).toBe(-1451);
  });

  it('applies a percent promo', () => {
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines: [assetPro(70000)],
      freePeriod: null,
      promo: promo(),
    });
    expect(discounts).toHaveLength(1);
    expect(discounts[0]).toMatchObject({
      lineType: 'PROMO_DISCOUNT',
      amountCents: -14000,
    });
  });

  it("applies the promo to a deleted machine's final days too", () => {
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines: [assetPro(1607, 'ASSET_PRO_FINAL_DAYS')],
      freePeriod: null,
      promo: promo(),
    });
    expect(discounts).toEqual([
      expect.objectContaining({
        lineType: 'PROMO_DISCOUNT',
        amountCents: -321,
      }),
    ]);
  });

  it('applies a fixed promo, capped at the machine charges', () => {
    const fixed = promo({ discountType: 'fixed_cents', discountValue: 10000 });
    expect(
      calculateDiscountLines({
        periodStart: APRIL,
        lines: [assetPro(70000)],
        freePeriod: null,
        promo: fixed,
      })[0].amountCents,
    ).toBe(-10000);
    const lines = [assetPro(7000)];
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines,
      freePeriod: null,
      promo: fixed,
    });
    expect(discounts[0].amountCents).toBe(-7000);
    expect(total([...lines, ...discounts])).toBe(0);
  });

  it('applies the free period first, then the promo on what is left', () => {
    const lines = [assetPro(100000)];
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines,
      freePeriod: free({ percent: 50 }),
      promo: promo({ discountValue: 10 }),
    });
    expect(discounts.map((line) => [line.lineType, line.amountCents])).toEqual([
      ['FREE_PERIOD_DISCOUNT', -50000],
      ['PROMO_DISCOUNT', -5000],
    ]);
  });

  it('never goes below zero with a free period and a fixed promo', () => {
    const lines = [assetPro(30000)];
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines,
      freePeriod: free({ percent: 90 }),
      promo: promo({ discountType: 'fixed_cents', discountValue: 50000 }),
    });
    expect(total([...lines, ...discounts])).toBe(0);
  });

  it('adds no promo line after a 100% free month', () => {
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines: [assetPro(70000)],
      freePeriod: free(),
      promo: promo(),
    });
    expect(discounts.map((line) => line.lineType)).toEqual([
      'FREE_PERIOD_DISCOUNT',
    ]);
  });

  it('only discounts machine charges, not other lines', () => {
    const onboarding = { ...assetPro(250000), lineType: 'ONBOARD_ASSISTED' };
    const discounts = calculateDiscountLines({
      periodStart: APRIL,
      lines: [
        assetPro(70000),
        assetPro(14583, 'ASSET_PRO_OVER_COMMIT'),
        onboarding,
      ],
      freePeriod: free(),
      promo: null,
    });
    expect(discounts[0].amountCents).toBe(-84583);
  });

  it('adds nothing without machine charges', () => {
    expect(
      calculateDiscountLines({
        periodStart: APRIL,
        lines: [{ ...assetPro(4900), lineType: 'TECH' }],
        freePeriod: free(),
        promo: promo(),
      }),
    ).toEqual([]);
  });

  it('ends a promo after its last month', () => {
    const threeMonths = promo({ endsMonth: '2026-06-01' });
    expect(isPromoActiveForMonth(threeMonths, '2026-03-01')).toBe(false);
    expect(isPromoActiveForMonth(threeMonths, APRIL)).toBe(true);
    expect(isPromoActiveForMonth(threeMonths, '2026-06-01')).toBe(true);
    expect(isPromoActiveForMonth(threeMonths, '2026-07-01')).toBe(false);
    expect(
      calculateDiscountLines({
        periodStart: '2026-07-01',
        lines: [assetPro(70000)],
        freePeriod: null,
        promo: threeMonths,
      }),
    ).toEqual([]);
  });

  it('stores snapshots that recalculate every discount to the cent (T31)', () => {
    for (const terms of [
      {
        freePeriod: free({ percent: 33 }),
        promo: promo({ discountValue: 15 }),
      },
      {
        freePeriod: null,
        promo: promo({
          discountType: 'fixed_cents' as const,
          discountValue: 1234,
        }),
      },
    ]) {
      const discounts = calculateDiscountLines({
        periodStart: APRIL,
        lines: [assetPro(87500)],
        ...terms,
      });
      for (const line of discounts) {
        const stored = JSON.parse(JSON.stringify(line.calcSnapshot));
        expect(recalculateLineAmountCents(stored)).toBe(line.amountCents);
      }
    }
  });
});
