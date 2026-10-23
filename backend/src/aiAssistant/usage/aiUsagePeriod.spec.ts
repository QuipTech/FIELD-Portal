import { toAllowanceUsage, toUtcMonth } from './aiUsagePeriod';

describe('toUtcMonth', () => {
  it('spans the UTC calendar month, across a year end', () => {
    expect(toUtcMonth(new Date('2026-12-31T23:30:00Z'))).toEqual({
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2027-01-01T00:00:00Z'),
    });
  });
});

describe('toAllowanceUsage', () => {
  it('never reports negative remaining', () => {
    expect(toAllowanceUsage(320, 300)).toEqual({
      used: 320,
      allowance: 300,
      remaining: 0,
    });
  });

  it('has no remaining without an allowance', () => {
    expect(toAllowanceUsage(5, null).remaining).toBeNull();
  });
});
