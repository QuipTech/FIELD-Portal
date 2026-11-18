import {
  daysBetween,
  findCreditLimitAction,
  findReminderDue,
  firstSuspensionDay,
  reminderLeadDays,
} from './overdueRules';

const OFFSETS = [-7, 0, 7, 14];

const due = (
  today: string,
  sentOffsets: number[] = [],
  collectionMethod:
    'charge_automatically' | 'send_invoice' | null = 'send_invoice',
) =>
  findReminderDue({
    dueOn: '2026-10-14',
    today,
    offsets: OFFSETS,
    sentOffsets,
    collectionMethod,
  });

describe('reminder schedule', () => {
  it('counts whole days between billing days', () => {
    expect(daysBetween('2026-10-14', '2026-10-21')).toBe(7);
    expect(daysBetween('2026-10-14', '2026-10-07')).toBe(-7);
  });

  it('reminds 7 days before, on the due date, then 7 and 14 days overdue', () => {
    expect(due('2026-10-06')).toBeNull();
    expect(due('2026-10-07')).toBe(-7);
    expect(due('2026-10-10', [-7])).toBeNull();
    expect(due('2026-10-14', [-7])).toBe(0);
    expect(due('2026-10-20', [-7, 0])).toBeNull();
    expect(due('2026-10-21', [-7, 0])).toBe(7);
    expect(due('2026-10-28', [-7, 0, 7])).toBe(14);
    expect(due('2026-11-30', [-7, 0, 7, 14])).toBeNull();
  });

  it('sends only the latest reminder that has come round, never a burst', () => {
    expect(due('2026-10-22')).toBe(7);
    expect(due('2026-10-22', [7])).toBeNull();
  });

  it('sends no "coming up" reminder for a card charged automatically', () => {
    expect(due('2026-10-07', [], 'charge_automatically')).toBeNull();
    expect(due('2026-10-14', [], 'charge_automatically')).toBe(0);
    expect(due('2026-10-07', [], null)).toBe(-7);
  });

  it('follows the configured offsets', () => {
    expect(
      findReminderDue({
        dueOn: '2026-10-14',
        today: '2026-10-15',
        offsets: [1, 7],
        sentOffsets: [],
        collectionMethod: 'send_invoice',
      }),
    ).toBe(1);
    expect(reminderLeadDays(OFFSETS)).toBe(7);
    expect(reminderLeadDays([0, 7])).toBe(0);
    expect(reminderLeadDays([])).toBe(0);
  });
});

describe('suspension and credit limit', () => {
  it('allows suspension the notice period after the earliest unpaid due date', () => {
    expect(firstSuspensionDay('2026-10-14', 14)?.toISOString()).toBe(
      '2026-10-28T00:00:00.000Z',
    );
    expect(firstSuspensionDay(null, 14)).toBeNull();
  });

  it('warns once when the unpaid balance goes over the credit limit', () => {
    expect(
      findCreditLimitAction({
        unpaidCents: 100001,
        creditLimitCents: 100000,
        warned: false,
      }),
    ).toBe('warn');
    expect(
      findCreditLimitAction({
        unpaidCents: 150000,
        creditLimitCents: 100000,
        warned: true,
      }),
    ).toBeNull();
    expect(
      findCreditLimitAction({
        unpaidCents: 100000,
        creditLimitCents: 100000,
        warned: true,
      }),
    ).toBe('clear');
    expect(
      findCreditLimitAction({
        unpaidCents: 100000,
        creditLimitCents: 100000,
        warned: false,
      }),
    ).toBeNull();
  });

  it('never warns without a credit limit', () => {
    expect(
      findCreditLimitAction({
        unpaidCents: 9_999_999,
        creditLimitCents: null,
        warned: false,
      }),
    ).toBeNull();
  });
});
