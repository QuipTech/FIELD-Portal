// Pure rules for overdue invoices (spec section 9): notices on day 1 and
// day 7 overdue, and suspension allowed only after the written notice
// period (SUSPENSION_NOTICE_DAYS) from the first notice.

const DAY_MS = 24 * 60 * 60 * 1000;

// Whole days from `from` to `to` (YYYY-MM-DD); negative when `to` is earlier.
export const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

export type OverdueNotice = 'day1' | 'day7';

// The notice due today for an unpaid invoice, if any. The day-7 notice is
// never sent before the day-1 one.
export const findNoticeDue = (params: {
  dueOn: string;
  today: string;
  notice1SentAt: Date | null;
  notice7SentAt: Date | null;
}): OverdueNotice | null => {
  const daysOverdue = daysBetween(params.dueOn, params.today);
  if (daysOverdue < 1) return null;
  if (!params.notice1SentAt) return 'day1';
  if (daysOverdue >= 7 && !params.notice7SentAt) return 'day7';
  return null;
};

// The first day suspension is allowed, or null when no notice was sent.
export const firstSuspensionDay = (
  firstNoticeSentAt: Date | null,
  noticeDays: number,
): Date | null =>
  firstNoticeSentAt
    ? new Date(firstNoticeSentAt.getTime() + noticeDays * DAY_MS)
    : null;
