import { daysBetween, findNoticeDue, firstSuspensionDay } from './overdueRules';

describe('overdue rules (spec section 9)', () => {
  const base = {
    dueOn: '2026-10-14',
    notice1SentAt: null,
    notice7SentAt: null,
  };

  it('counts whole days between billing days', () => {
    expect(daysBetween('2026-10-14', '2026-10-21')).toBe(7);
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
  });

  it('sends nothing on the due date itself', () => {
    expect(findNoticeDue({ ...base, today: '2026-10-14' })).toBeNull();
  });

  it('sends the first notice once the invoice is 1 day overdue', () => {
    expect(findNoticeDue({ ...base, today: '2026-10-15' })).toBe('day1');
  });

  it('sends the 7-day notice after the first, never before it', () => {
    expect(findNoticeDue({ ...base, today: '2026-10-25' })).toBe('day1');
    expect(
      findNoticeDue({
        ...base,
        today: '2026-10-21',
        notice1SentAt: new Date(),
      }),
    ).toBe('day7');
    expect(
      findNoticeDue({
        ...base,
        today: '2026-10-30',
        notice1SentAt: new Date(),
        notice7SentAt: new Date(),
      }),
    ).toBeNull();
  });

  it('allows suspension only after the written notice period', () => {
    const first = new Date('2026-10-15T00:00:00Z');
    expect(firstSuspensionDay(first, 14)?.toISOString()).toBe(
      '2026-10-29T00:00:00.000Z',
    );
    expect(firstSuspensionDay(null, 14)).toBeNull();
  });
});
