import {
  calculateAnnualUpFrontCents,
  calculateOverCommitCents,
} from './annualPricing';
import { ANNUAL_MONTHS_CHARGED, ASSET_PRO_V1 } from './priceBookV1Fixture';

const { bands } = ASSET_PRO_V1;

describe('annual prepaid ASSET_PRO', () => {
  it('T13: Q = 15 costs A$5,250.00 up front', () => {
    expect(calculateAnnualUpFrontCents(bands, 15, ANNUAL_MONTHS_CHARGED)).toBe(
      525000,
    );
  });

  it('T13: a month with peak 20 adds ASSET_PRO_OVER_COMMIT of A$145.83', () => {
    expect(calculateOverCommitCents(bands, 20, 15, ANNUAL_MONTHS_CHARGED)).toBe(
      14583,
    );
  });

  it('adds nothing at or below the commitment, and never refunds', () => {
    expect(calculateOverCommitCents(bands, 15, 15, ANNUAL_MONTHS_CHARGED)).toBe(
      0,
    );
    expect(calculateOverCommitCents(bands, 3, 15, ANNUAL_MONTHS_CHARGED)).toBe(
      0,
    );
  });

  it('prices the over-commit across a band change at the new whole-fleet rate', () => {
    // price(26) − price(25) = 754 − 875 is negative: the bigger fleet is cheaper.
    expect(calculateOverCommitCents(bands, 26, 25, ANNUAL_MONTHS_CHARGED)).toBe(
      0,
    );
    // price(30) − price(20) = 870 − 700 = 170 → 170 × 10/12 = 141.666… → 141.67
    expect(calculateOverCommitCents(bands, 30, 20, ANNUAL_MONTHS_CHARGED)).toBe(
      14167,
    );
  });
});
