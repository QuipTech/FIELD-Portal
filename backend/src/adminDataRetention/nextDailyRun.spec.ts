import { msUntilNextDailyRun } from './nextDailyRun';

const HOUR = 60 * 60 * 1000;

describe('msUntilNextDailyRun', () => {
  it('runs later today when the hour is still ahead', () => {
    expect(msUntilNextDailyRun(17, new Date('2027-01-10T15:30:00Z'))).toBe(
      1.5 * HOUR,
    );
  });

  it('runs tomorrow when the hour has passed (or is now)', () => {
    expect(msUntilNextDailyRun(17, new Date('2027-01-10T17:00:00Z'))).toBe(
      24 * HOUR,
    );
    expect(msUntilNextDailyRun(2, new Date('2027-01-31T03:00:00Z'))).toBe(
      23 * HOUR,
    );
  });
});
