import {
  planAnnualTerm,
  planCancellation,
  planMonthlyTerm,
  planRenewal,
} from './subscriptionTerms';
import { Subscription } from './subscriptionTypes';

const subscription = (overrides: Partial<Subscription>): Subscription => ({
  id: 'sub-1',
  billingAccountId: 'account-1',
  planCode: 'ASSET_PRO',
  priceBookId: 'book-v1',
  term: 'monthly',
  committedQty: null,
  annualMonthsCharged: null,
  contractAnnualCents: null,
  status: 'active',
  startedAt: '2026-04-16T00:00:00.000Z',
  currentPeriodStart: '2026-04-01',
  currentPeriodEnd: '2026-05-01',
  cancelAt: null,
  exportUntil: null,
  deleteAfter: null,
  nextTerm: null,
  nextCommittedQty: null,
  ...overrides,
});

describe('subscription terms', () => {
  it('starts monthly on the calendar month, with no commitment', () => {
    expect(planMonthlyTerm('2026-04-16', 'book-v1')).toEqual({
      term: 'monthly',
      priceBookId: 'book-v1',
      periodStart: '2026-04-01',
      periodEnd: '2026-05-01',
      committedQty: null,
      annualMonthsCharged: null,
    });
  });

  it('runs an annual term for 12 months and pins months charged', () => {
    expect(planAnnualTerm('2026-04-16', 'book-v1', 15, 10)).toMatchObject({
      periodStart: '2026-04-16',
      periodEnd: '2027-04-16',
      committedQty: 15,
      annualMonthsCharged: 10,
    });
  });

  it('refuses an annual term without a positive commitment', () => {
    expect(() => planAnnualTerm('2026-04-16', 'book-v1', 0, 10)).toThrow(
      RangeError,
    );
  });

  it('T27: renewal re-pins the price book in effect at renewal', () => {
    const renewed = planRenewal(subscription({}), {
      priceBookInEffectId: 'book-v2',
      currentCount: 12,
      requestedQty: null,
      monthsCharged: 10,
    });
    expect(renewed).toMatchObject({
      priceBookId: 'book-v2',
      periodStart: '2026-05-01',
      periodEnd: '2026-06-01',
    });
  });

  it('resets annual Q to the current count at renewal', () => {
    const annual = subscription({
      term: 'annual',
      committedQty: 15,
      annualMonthsCharged: 10,
      currentPeriodStart: '2026-04-16',
      currentPeriodEnd: '2027-04-16',
    });
    const inputs = {
      priceBookInEffectId: 'book-v1',
      currentCount: 22,
      requestedQty: null,
      monthsCharged: 10,
    };
    expect(planRenewal(annual, inputs)).toMatchObject({
      committedQty: 22,
      periodStart: '2027-04-16',
      periodEnd: '2028-04-16',
    });
  });

  it('switches a monthly customer to the annual term they chose, from the renewal', () => {
    const monthly = subscription({ nextTerm: 'annual', nextCommittedQty: 18 });
    expect(
      planRenewal(monthly, {
        priceBookInEffectId: 'book-v1',
        currentCount: 12,
        requestedQty: null,
        monthsCharged: 10,
      }),
    ).toEqual({
      term: 'annual',
      priceBookId: 'book-v1',
      periodStart: '2026-05-01',
      periodEnd: '2027-05-01',
      committedQty: 18,
      annualMonthsCharged: 10,
    });
  });

  it('goes back to monthly at the end of an annual term when chosen', () => {
    const annual = subscription({
      term: 'annual',
      committedQty: 15,
      annualMonthsCharged: 10,
      currentPeriodStart: '2026-04-16',
      currentPeriodEnd: '2027-04-16',
      nextTerm: 'monthly',
    });
    expect(
      planRenewal(annual, {
        priceBookInEffectId: 'book-v2',
        currentCount: 22,
        requestedQty: null,
        monthsCharged: 10,
      }),
    ).toMatchObject({
      term: 'monthly',
      committedQty: null,
      periodStart: '2027-04-01',
      periodEnd: '2027-05-01',
    });
  });

  it("keeps the customer's chosen Q at renewal", () => {
    const annual = subscription({ term: 'annual', committedQty: 15 });
    expect(
      planRenewal(annual, {
        priceBookInEffectId: 'book-v1',
        currentCount: 22,
        requestedQty: 30,
        monthsCharged: 10,
      }).committedQty,
    ).toBe(30);
  });

  it('cancels at the period end, then export and deletion windows', () => {
    expect(planCancellation(subscription({}), 30, 90)).toEqual({
      cancelAt: '2026-05-01',
      exportUntil: '2026-05-31',
      deleteAfter: '2026-07-30',
    });
  });
});
