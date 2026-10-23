import {
  BillableInterval,
  listDaysBetween,
} from '../billingCalendar/billableInterval';
import {
  ANNUAL_MONTHS_CHARGED,
  ASSET_PRO_V1,
  TECH_SEAT_CENTS_V1,
} from '../pricing/priceBookV1Fixture';
import { buildDailyCounts } from './dailyCountRules';
import {
  calculateMonthlyLines,
  findMonthlyPeak,
  recalculateLineAmountCents,
} from './monthlyLineCalculation';
import { RunSubscription } from './monthlyRunTypes';

// April has 30 days (spec section 10).
const APRIL = { periodStart: '2026-04-01', periodEnd: '2026-05-01' };
const MAY = { periodStart: '2026-05-01', periodEnd: '2026-06-01' };

const machines = (
  count: number,
  startedOn = '2026-03-01',
  billingEnd: string | null = null,
): BillableInterval[] =>
  Array.from({ length: count }, () => ({ startedOn, billingEnd }));

const assetPro = (
  overrides: Partial<RunSubscription> = {},
): RunSubscription => ({
  id: 'sub-asset',
  planCode: 'ASSET_PRO',
  term: 'monthly',
  committedQty: null,
  annualMonthsCharged: null,
  book: ASSET_PRO_V1,
  ...overrides,
});

const tech = (overrides: Partial<RunSubscription> = {}): RunSubscription => ({
  id: 'sub-tech',
  planCode: 'TECH',
  term: 'monthly',
  committedQty: null,
  annualMonthsCharged: null,
  book: {
    ...ASSET_PRO_V1,
    id: 'tech-v1',
    planCode: 'TECH',
    unitCents: TECH_SEAT_CENTS_V1,
    bands: [],
  },
  ...overrides,
});

const runMonth = (
  period: { periodStart: string; periodEnd: string },
  intervals: { machines?: BillableInterval[]; seats?: BillableInterval[] },
  subscriptions: RunSubscription[],
) =>
  calculateMonthlyLines({
    ...period,
    counts: buildDailyCounts(
      intervals.machines ?? [],
      intervals.seats ?? [],
      listDaysBetween(period.periodStart, period.periodEnd),
    ),
    subscriptions,
  });

describe('monthly run: peak and charges (spec section 10)', () => {
  it('T9: 15 machines all April, 5 more on 21 April → peak 20, A$700.00', () => {
    const [line] = runMonth(
      APRIL,
      { machines: [...machines(15), ...machines(5, '2026-04-21')] },
      [assetPro()],
    );
    expect(line).toMatchObject({
      lineType: 'ASSET_PRO',
      quantity: 20,
      unitCents: 3500,
      amountCents: 70000,
    });
    expect(line.calcSnapshot).toMatchObject({
      peak: 20,
      peakDay: '2026-04-21',
    });
  });

  it('T10: 20 machines, 5 deactivated 10 April → April A$700.00, May A$525.00', () => {
    const intervals = {
      machines: [...machines(15), ...machines(5, '2026-03-01', '2026-05-01')],
    };
    expect(runMonth(APRIL, intervals, [assetPro()])[0].amountCents).toBe(70000);
    expect(runMonth(MAY, intervals, [assetPro()])[0].amountCents).toBe(52500);
  });

  it('T11: 10 steady, A deactivated 5 April, B activated 20 April → peak 12, A$420.00', () => {
    const [line] = runMonth(
      APRIL,
      {
        machines: [
          ...machines(10),
          ...machines(1, '2026-03-01', '2026-05-01'),
          ...machines(1, '2026-04-20'),
        ],
      },
      [assetPro()],
    );
    expect(line).toMatchObject({ quantity: 12, amountCents: 42000 });
  });

  it('T12: 25 machines, 1 more on 16 April → peak 26, all at A$29, A$754.00', () => {
    const [line] = runMonth(
      APRIL,
      { machines: [...machines(25), ...machines(1, '2026-04-16')] },
      [assetPro()],
    );
    expect(line).toMatchObject({
      quantity: 26,
      unitCents: 2900,
      amountCents: 75400,
    });
  });

  it('T13: annual Q = 15, a month with peak 20 adds over-commit A$145.83', () => {
    const [line] = runMonth(APRIL, { machines: machines(20) }, [
      assetPro({
        term: 'annual',
        committedQty: 15,
        annualMonthsCharged: ANNUAL_MONTHS_CHARGED,
      }),
    ]);
    expect(line).toMatchObject({
      lineType: 'ASSET_PRO_OVER_COMMIT',
      quantity: 1,
      amountCents: 14583,
    });
  });

  it('adds nothing for an annual account at or below its commitment', () => {
    expect(
      runMonth(APRIL, { machines: machines(15) }, [
        assetPro({
          term: 'annual',
          committedQty: 15,
          annualMonthsCharged: ANNUAL_MONTHS_CHARGED,
        }),
      ]),
    ).toEqual([]);
  });

  it('T14: TECH 2 seats, a third added 16 April → peak 3, A$147.00', () => {
    const [line] = runMonth(
      APRIL,
      { seats: [...machines(2), ...machines(1, '2026-04-16')] },
      [tech()],
    );
    expect(line).toMatchObject({
      lineType: 'TECH',
      quantity: 3,
      amountCents: 14700,
    });
  });

  it('TECH annual: charges only seats above the commitment at A$49 × 10/12', () => {
    const [line] = runMonth(APRIL, { seats: machines(5) }, [
      tech({
        term: 'annual',
        committedQty: 3,
        annualMonthsCharged: ANNUAL_MONTHS_CHARGED,
      }),
    ]);
    expect(line).toMatchObject({
      quantity: 2,
      unitCents: 4083,
      amountCents: 8166,
    });
  });

  it('bills nothing for a month with no active machines or seats', () => {
    expect(runMonth(APRIL, {}, [assetPro(), tech()])).toEqual([]);
  });

  it('leaves Enterprise and internal plans to their own invoicing', () => {
    expect(
      runMonth(APRIL, { machines: machines(30) }, [
        assetPro({ planCode: 'ENTERPRISE' }),
        assetPro({ planCode: 'INTERNAL' }),
      ]),
    ).toEqual([]);
  });

  it('T31: every line recalculates to the cent from its stored snapshot', () => {
    const lines = [
      ...runMonth(
        APRIL,
        { machines: [...machines(25), ...machines(1, '2026-04-16')] },
        [assetPro()],
      ),
      ...runMonth(APRIL, { machines: machines(20) }, [
        assetPro({
          term: 'annual',
          committedQty: 15,
          annualMonthsCharged: ANNUAL_MONTHS_CHARGED,
        }),
      ]),
      ...runMonth(APRIL, { seats: machines(5) }, [
        tech({
          term: 'annual',
          committedQty: 3,
          annualMonthsCharged: ANNUAL_MONTHS_CHARGED,
        }),
      ]),
    ];
    for (const line of lines) {
      // As stored in jsonb and read back.
      const stored = JSON.parse(JSON.stringify(line.calcSnapshot));
      expect(recalculateLineAmountCents(stored)).toBe(line.amountCents);
    }
  });

  it('keeps the first day a peak was reached', () => {
    expect(
      findMonthlyPeak(
        [
          { day: '2026-04-01', activeMachines: 3, techSeats: 0 },
          { day: '2026-04-02', activeMachines: 5, techSeats: 0 },
          { day: '2026-04-03', activeMachines: 5, techSeats: 0 },
        ],
        (count) => count.activeMachines,
      ),
    ).toEqual({ count: 5, day: '2026-04-02' });
  });
});
