import {
  findEnterpriseQuoteProblem,
  hasReachedEnterpriseThreshold,
} from './enterpriseRules';
import {
  ENTERPRISE_MINIMUM_ANNUAL_CENTS_V1,
  ENTERPRISE_THRESHOLD_MACHINES,
} from './priceBookV1Fixture';

describe('Enterprise rules', () => {
  it('T8: 500 machines on self-serve reach the Enterprise threshold', () => {
    expect(
      hasReachedEnterpriseThreshold(500, ENTERPRISE_THRESHOLD_MACHINES),
    ).toBe(true);
    expect(
      hasReachedEnterpriseThreshold(499, ENTERPRISE_THRESHOLD_MACHINES),
    ).toBe(false);
  });

  it('T8a: a quote below A$5,000 a year is rejected at contract set-up', () => {
    expect(
      findEnterpriseQuoteProblem(499999, ENTERPRISE_MINIMUM_ANNUAL_CENTS_V1),
    ).toMatch(/at least 500000 cents a year/);
  });

  it('T8a: a quote of exactly the minimum is accepted', () => {
    expect(
      findEnterpriseQuoteProblem(500000, ENTERPRISE_MINIMUM_ANNUAL_CENTS_V1),
    ).toBeNull();
  });

  it('rejects a quote that is not whole cents', () => {
    expect(
      findEnterpriseQuoteProblem(600000.5, ENTERPRISE_MINIMUM_ANNUAL_CENTS_V1),
    ).toMatch(/whole cents/);
  });
});
