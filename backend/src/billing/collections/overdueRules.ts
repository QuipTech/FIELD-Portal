// Pure rules for unpaid invoices: reminders on a configurable schedule
// around the due date (INVOICE_REMINDER_OFFSET_DAYS), suspension allowed
// SUSPENSION_NOTICE_DAYS after the earliest unpaid due date, and the credit
// limit warning. Nothing here ever blocks an account by itself.

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days from `from` to `to` (YYYY-MM-DD); negative when `to` is earlier.
export const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

export type CollectionMethod = 'charge_automatically' | 'send_invoice';

// The reminder to send today, as its offset from the due date, or null.
// Only the latest reminder that has come round is sent: one missed while
// the job was down is superseded by the next, never sent late as a burst.
// A card that is charged automatically gets no "coming up" reminders.
export const findReminderDue = (params: {
  dueOn: string;
  today: string;
  offsets: number[];
  sentOffsets: number[];
  collectionMethod: CollectionMethod | null;
}): number | null => {
  const daysFromDue = daysBetween(params.dueOn, params.today);
  const latest = params.offsets
    .filter((offset) => offset <= daysFromDue)
    .filter(
      (offset) =>
        offset >= 0 || params.collectionMethod !== 'charge_automatically',
    )
    .sort((a, b) => b - a)[0];
  if (latest === undefined) return null;
  if (params.sentOffsets.some((sent) => sent >= latest)) return null;
  return latest;
};

// How many days before the due date the first reminder goes out (0 when
// none are before it), so the job only reads invoices that could need one.
export const reminderLeadDays = (offsets: number[]): number =>
  Math.max(0, ...offsets.map((offset) => -offset));

// The first day suspension is allowed: the notice period counts from the
// earliest unpaid due date. null when nothing is overdue.
export const firstSuspensionDay = (
  firstUnpaidDueOn: string | null,
  noticeDays: number,
): Date | null =>
  firstUnpaidDueOn
    ? new Date(
        Date.parse(`${firstUnpaidDueOn}T00:00:00Z`) + noticeDays * DAY_MS,
      )
    : null;

export type CreditLimitAction = 'warn' | 'clear' | null;

// Warn once each time the unpaid balance goes over the limit; clear the
// flag once it's back at or under, so the next crossing warns again.
export const findCreditLimitAction = (params: {
  unpaidCents: number;
  creditLimitCents: number | null;
  warned: boolean;
}): CreditLimitAction => {
  const over =
    params.creditLimitCents !== null &&
    params.unpaidCents > params.creditLimitCents;
  if (over && !params.warned) return 'warn';
  if (!over && params.warned) return 'clear';
  return null;
};
