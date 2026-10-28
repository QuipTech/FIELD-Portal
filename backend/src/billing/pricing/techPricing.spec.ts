import {
  ANNUAL_MONTHS_CHARGED,
  TECH_SEAT_CENTS_V1,
} from './priceBookV1Fixture';
import {
  calculateTechAnnualUpFrontCents,
  calculateTechExtraSeatUnitCents,
  calculateTechMonthlyCents,
} from './techPricing';

describe('TECH pricing', () => {
  it('charges the peak seats at A$49 a month (T14: peak 3 → A$147.00)', () => {
    expect(calculateTechMonthlyCents(3, TECH_SEAT_CENTS_V1)).toBe(14700);
  });

  it('charges annual seats × A$49 × 10 up front', () => {
    expect(
      calculateTechAnnualUpFrontCents(
        2,
        TECH_SEAT_CENTS_V1,
        ANNUAL_MONTHS_CHARGED,
      ),
    ).toBe(98000);
  });

  it('charges an extra annual seat at A$49 × 10/12, half-up: A$40.83', () => {
    expect(
      calculateTechExtraSeatUnitCents(
        TECH_SEAT_CENTS_V1,
        ANNUAL_MONTHS_CHARGED,
      ),
    ).toBe(4083);
  });

  it('refuses a negative seat count', () => {
    expect(() => calculateTechMonthlyCents(-1, TECH_SEAT_CENTS_V1)).toThrow(
      RangeError,
    );
  });
});
