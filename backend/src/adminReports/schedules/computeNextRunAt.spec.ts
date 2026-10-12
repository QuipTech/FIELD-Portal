import { computeNextRunAt } from './computeNextRunAt';
import { ReportTiming } from './scheduleTypes';

const timing = (overrides: Partial<ReportTiming>): ReportTiming => ({
  frequency: 'daily',
  dayOfWeek: null,
  dayOfMonth: null,
  sendHour: 6,
  timezone: 'Australia/Perth',
  ...overrides,
});

describe('computeNextRunAt', () => {
  it('sends later today when the hour is still ahead', () => {
    // 05:00 in Perth (UTC+8).
    const after = new Date('2026-10-01T21:00:00Z');
    expect(computeNextRunAt(timing({}), after).toISOString()).toBe(
      '2026-10-01T22:00:00.000Z',
    );
  });

  it('moves to tomorrow once the hour has passed', () => {
    const after = new Date('2026-10-01T22:00:00Z');
    expect(computeNextRunAt(timing({}), after).toISOString()).toBe(
      '2026-10-02T22:00:00.000Z',
    );
  });

  it('finds the next chosen weekday', () => {
    // Friday 2 Oct 2026, 10:00 in Perth; next Monday is 5 Oct.
    const after = new Date('2026-10-02T02:00:00Z');
    const next = computeNextRunAt(
      timing({ frequency: 'weekly', dayOfWeek: 1 }),
      after,
    );
    expect(next.toISOString()).toBe('2026-10-04T22:00:00.000Z');
  });

  it('finds the chosen day of next month', () => {
    const after = new Date('2026-10-02T02:00:00Z');
    const next = computeNextRunAt(
      timing({ frequency: 'monthly', dayOfMonth: 1, sendHour: 8 }),
      after,
    );
    expect(next.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('follows daylight saving', () => {
    // Sydney is UTC+10 before 4 Oct 2026 and UTC+11 after.
    const sydney = timing({ timezone: 'Australia/Sydney', sendHour: 9 });
    expect(
      computeNextRunAt(sydney, new Date('2026-10-02T00:00:00Z')).toISOString(),
    ).toBe('2026-10-02T23:00:00.000Z');
    expect(
      computeNextRunAt(sydney, new Date('2026-10-05T00:00:00Z')).toISOString(),
    ).toBe('2026-10-05T22:00:00.000Z');
  });
});
