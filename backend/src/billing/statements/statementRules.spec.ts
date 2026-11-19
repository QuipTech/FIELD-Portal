import { calculateMonthlyLines } from '../monthlyRun/monthlyLineCalculation';
import { calculateDiscountLines } from '../discounts/discountRules';
import { ASSET_PRO_V1 } from '../pricing/priceBookV1Fixture';
import {
  calculateDueOn,
  calculateGstCents,
  calculateStatementTotals,
  canMarkPaid,
  canSetZohoInvoice,
  countActiveDays,
  daysOverdue,
  formatStatementReference,
  isOverdue,
  summariseStatementLines,
} from './statementRules';

const APRIL = '2026-04-01';
const MAY = '2026-05-01';

const aprilCounts = (machines: number) =>
  Array.from({ length: 30 }, (_, index) => ({
    day: `2026-04-${String(index + 1).padStart(2, '0')}`,
    activeMachines: machines,
    techSeats: 0,
  }));

// The same lines the monthly run makes for a 30-day account.
const runLines = (
  machines: number,
  discounts: Parameters<typeof calculateDiscountLines>[0]['promo'] = null,
) => {
  const charges = calculateMonthlyLines({
    periodStart: APRIL,
    periodEnd: MAY,
    counts: aprilCounts(machines),
    subscriptions: [
      {
        id: 'sub-1',
        planCode: 'ASSET_PRO',
        term: 'monthly',
        committedQty: null,
        annualMonthsCharged: null,
        book: ASSET_PRO_V1,
      },
    ],
  });
  return [
    ...charges,
    ...calculateDiscountLines({
      periodStart: APRIL,
      lines: charges,
      freePeriod: { freeUntil: '2026-04-30', percent: 10 },
      promo: discounts,
    }),
  ];
};

describe('statement totals', () => {
  it('adds 10% GST, rounded half-up', () => {
    expect(calculateGstCents(70000)).toBe(7000);
    expect(calculateGstCents(12345)).toBe(1235);
    expect(calculateStatementTotals([{ amountCents: 12345 }])).toEqual({
      subtotalExGstCents: 12345,
      gstCents: 1235,
      totalIncGstCents: 13580,
    });
  });

  it('never goes below A$0', () => {
    expect(
      calculateStatementTotals([{ amountCents: 1000 }, { amountCents: -5000 }]),
    ).toEqual({ subtotalExGstCents: 0, gstCents: 0, totalIncGstCents: 0 });
  });

  it('matches the pricing engine: peak, band, unit price, discounts and subtotal', () => {
    const lines = runLines(20, {
      redemptionId: 'red-1',
      promoCodeId: 'promo-1',
      code: 'SPRING',
      discountType: 'percent',
      discountValue: 20,
      startsMonth: APRIL,
      endsMonth: null,
    });
    const figures = summariseStatementLines(lines);
    const engineCharge = lines.find((line) => line.lineType === 'ASSET_PRO');
    expect(figures).toMatchObject({
      peakActiveMachines: 20,
      unitPriceCents: engineCharge?.unitCents,
      machineChargeCents: engineCharge?.amountCents,
      otherChargesCents: 0,
    });
    expect(figures.rateBand).toMatch(/^\d+(–\d+|\+)$/);
    // 10% free period, then 20% promo on what's left.
    const charge = engineCharge?.amountCents ?? 0;
    expect(figures.freePeriodDiscountCents).toBe(-Math.round(charge * 0.1));
    const afterFree = charge + figures.freePeriodDiscountCents;
    expect(figures.promoDiscountCents).toBe(-Math.round(afterFree * 0.2));
    expect(calculateStatementTotals(lines).subtotalExGstCents).toBe(
      lines.reduce((sum, line) => sum + line.amountCents, 0),
    );
  });
});

describe('references and dates', () => {
  it('numbers statements FLD-YYYY-MM-NNNN', () => {
    expect(formatStatementReference('2026-11-01', 42)).toBe('FLD-2026-11-0042');
  });

  it('is due the Zoho invoice date plus the terms', () => {
    expect(calculateDueOn('2026-12-01', 30)).toBe('2026-12-31');
    expect(calculateDueOn('2026-12-15', 30)).toBe('2027-01-14');
  });

  it('is overdue only once invoiced, unpaid and past the Zoho due date', () => {
    const invoiced = {
      status: 'invoiced_external' as const,
      dueOn: '2026-12-31',
    };
    expect(isOverdue(invoiced, '2026-12-31')).toBe(false);
    expect(isOverdue(invoiced, '2027-01-01')).toBe(true);
    expect(daysOverdue(invoiced, '2027-01-10')).toBe(10);
    expect(
      isOverdue({ status: 'paid', dueOn: '2026-12-31' }, '2027-02-01'),
    ).toBe(false);
    expect(isOverdue({ status: 'ready', dueOn: null }, '2027-02-01')).toBe(
      false,
    );
  });

  it('takes the Zoho number once ready, and payment once invoiced', () => {
    expect(canSetZohoInvoice('draft')).toBe(false);
    expect(canSetZohoInvoice('ready')).toBe(true);
    expect(canMarkPaid('ready')).toBe(false);
    expect(canMarkPaid('invoiced_external')).toBe(true);
  });
});

describe('countActiveDays', () => {
  it("counts each machine's days in the month once, clipped to the month", () => {
    expect(
      countActiveDays(
        [
          { activatedOn: '2026-03-20', billingEnd: '2026-04-05' },
          { activatedOn: '2026-04-03', billingEnd: '2026-04-11' },
          { activatedOn: '2026-04-28', billingEnd: null },
        ],
        APRIL,
        MAY,
      ),
    ).toBe(13);
  });
});
