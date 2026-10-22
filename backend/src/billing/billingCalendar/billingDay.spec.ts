import {
  addDaysToDay,
  addMonthsToDay,
  firstDayOfMonth,
  firstDayOfNextMonth,
  toBillingDay,
} from './billingDay';

describe('billing days', () => {
  it("uses the account's time zone for the day boundary", () => {
    // 15:30 UTC on 30 April is 01:30 on 1 May in Brisbane (UTC+10).
    const instant = new Date('2026-04-30T15:30:00Z');
    expect(toBillingDay(instant, 'Australia/Brisbane')).toBe('2026-05-01');
    expect(toBillingDay(instant, 'Australia/Perth')).toBe('2026-04-30');
  });

  it('keeps the day across a daylight-saving change', () => {
    // Sydney moves to AEDT on 4 October 2026.
    expect(
      toBillingDay(new Date('2026-10-03T14:30:00Z'), 'Australia/Sydney'),
    ).toBe('2026-10-04');
    expect(addDaysToDay('2026-10-03', 1)).toBe('2026-10-04');
  });

  it('finds the first day of the month and of the next month', () => {
    expect(firstDayOfMonth('2026-04-21')).toBe('2026-04-01');
    expect(firstDayOfNextMonth('2026-04-05')).toBe('2026-05-01');
    expect(firstDayOfNextMonth('2026-12-31')).toBe('2027-01-01');
  });

  it('adds months, clamping to a shorter month', () => {
    expect(addMonthsToDay('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDay('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsToDay('2026-04-16', 12)).toBe('2027-04-16');
  });

  it('refuses a value that is not a day', () => {
    expect(() => firstDayOfMonth('2026-4-1')).toThrow(RangeError);
  });
});
