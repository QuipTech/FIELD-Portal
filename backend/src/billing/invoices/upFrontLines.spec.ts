import { ASSET_PRO_V1 } from '../pricing/priceBookV1Fixture';
import { recalculateLineAmountCents } from '../monthlyRun/monthlyLineCalculation';
import {
  calculateAnnualTermLine,
  calculateOnboardingLine,
} from './upFrontLines';

const term = {
  subscriptionId: 'sub-1',
  committedQty: 15,
  monthsCharged: 10,
  periodStart: '2026-11-01',
  periodEnd: '2027-11-01',
};

describe('up-front invoice lines', () => {
  it('charges annual ASSET_PRO price(Q) × 10 up front (T13: A$5,250 for 15)', () => {
    const line = calculateAnnualTermLine(
      { ...term, planCode: 'ASSET_PRO' },
      ASSET_PRO_V1,
    )!;
    expect(line).toMatchObject({
      lineType: 'ASSET_PRO_ANNUAL',
      amountCents: 525000,
    });
    expect(recalculateLineAmountCents(line.calcSnapshot)).toBe(525000);
  });

  it('charges annual TECH seats × A$49 × 10 up front', () => {
    const book = {
      ...ASSET_PRO_V1,
      planCode: 'TECH',
      unitCents: 4900,
      bands: [],
    };
    const line = calculateAnnualTermLine(
      { ...term, planCode: 'TECH', committedQty: 3 },
      book,
    )!;
    expect(line).toMatchObject({
      lineType: 'TECH_ANNUAL',
      amountCents: 147000,
    });
    expect(recalculateLineAmountCents(line.calcSnapshot)).toBe(147000);
  });

  it('has no up-front line for other plans', () => {
    expect(
      calculateAnnualTermLine(
        { ...term, planCode: 'ENTERPRISE' },
        ASSET_PRO_V1,
      ),
    ).toBeNull();
  });

  it('invoices one site of assisted onboarding at the price book price', () => {
    const book = {
      ...ASSET_PRO_V1,
      planCode: 'ONBOARD_ASSISTED',
      unitCents: 250000,
      bands: [],
    };
    const line = calculateOnboardingLine('Pit 4', '2026-10-26', book);
    expect(line).toMatchObject({
      lineType: 'ONBOARD_ASSISTED',
      amountCents: 250000,
      quantity: 1,
    });
    expect(recalculateLineAmountCents(line.calcSnapshot)).toBe(250000);
  });
});
