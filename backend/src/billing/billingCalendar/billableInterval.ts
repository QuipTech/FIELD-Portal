import { addDaysToDay } from './billingDay';

// A machine activation or a TECH seat: billable from startedOn until (not
// including) billingEnd; null = still open.
export interface BillableInterval {
  startedOn: string;
  billingEnd: string | null;
}

// The peak rule (spec section 3): counted on day d when
// startedOn <= d and (billingEnd is null or d < billingEnd).
export const countIntervalsOnDay = (
  intervals: BillableInterval[],
  day: string,
): number =>
  intervals.filter(
    (interval) =>
      interval.startedOn <= day &&
      (interval.billingEnd === null || day < interval.billingEnd),
  ).length;

// Every billing day from `from` up to (not including) `until`.
export const listDaysBetween = (from: string, until: string): string[] => {
  const days: string[] = [];
  for (let day = from; day < until; day = addDaysToDay(day, 1)) days.push(day);
  return days;
};
