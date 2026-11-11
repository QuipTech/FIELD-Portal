import {
  addDaysToDay,
  firstDayOfMonth,
  firstDayOfNextMonth,
} from '../billing/billingCalendar/billingDay';
import { divideRoundHalfUp } from '../billing/pricing/roundHalfUp';
import { LifecycleState } from './lifecycleTransitions';

// Whether a machine may be deleted, and what it still owes. Pure, so the rules
// are testable.
//   * A monthly invoice already issued must be paid before the machine goes.
//   * On a monthly plan, the month still open and last month, if the run hasn't
//     invoiced it, are paid now at the daily rate, up to the day it was deactivated,
//     and the machine then comes off those months' peaks (billing spec section 3,
//     rule 3a). Nobody waits on the run. Older months are left alone: the run only
//     ever bills the month before, so a gap there predates billing or was waived.
//   * On an annual plan the term is paid up front, so it waits for the month-end
//     run, which works out any over-commitment. Enterprise and internal plans
//     have no machine charge.

export type MachineDeletionBlocker =
  | 'needs_deactivation'
  | 'sold'
  | 'open_cases'
  | 'pending_transfer'
  | 'awaiting_final_invoice'
  | 'unpaid_invoices'
  | 'final_charge_due';

export type MachinePlanBilling = 'monthly' | 'annual' | 'none';

export interface DeletionInvoice {
  id: string;
  periodStart: string;
  status: string;
  totalExGstCents: number;
  hostedInvoiceUrl: string | null;
  // This machine's own final charge, rather than a monthly invoice.
  isFinalCharge: boolean;
}

export interface BillingIntervalUse {
  activatedOn: string;
  billingEnd: string | null;
  // The day it was deactivated, null on rows from before that was recorded.
  lastUsedOn: string | null;
}

export interface DeletionFacts {
  state: LifecycleState;
  today: string;
  openCaseCount: number;
  hasPendingTransfer: boolean;
  plan: MachinePlanBilling;
  // This billing account's intervals; none if the machine was never billed.
  intervals: BillingIntervalUse[];
  // This account's monthly invoices and this machine's final charges for the
  // months in billedMonthRange, none void.
  invoices: DeletionInvoice[];
  // Months this machine has a final charge for, none void. One charge can cover
  // several months.
  finalChargedMonths: string[];
  // The run has processed the day after the last closed month, so a month with
  // no invoice had nothing to bill (Enterprise, internal, within a commitment).
  runPassedLastClosedMonth: boolean;
}

export interface FinalChargeQuote {
  periodStart: string;
  lastUsedOn: string;
  daysUsed: number;
  daysInMonth: number;
  monthlyRateCents: number;
  amountCents: number;
}

// Everything to pay in one go, oldest month first.
export interface FinalChargeDue {
  amountCents: number;
  months: FinalChargeQuote[];
}

export interface MachineDeletionCheck {
  canDelete: boolean;
  blocker: MachineDeletionBlocker | null;
  message: string | null;
  // First day the final invoice can exist, when waiting for it.
  finalInvoiceFrom: string | null;
  unpaidInvoices: {
    id: string;
    periodStart: string;
    status: string;
    hostedInvoiceUrl: string | null;
    isFinalCharge: boolean;
  }[];
  // The months paying now would cover, when final_charge_due.
  monthsDue: string[];
  // What paying now would cost, when final_charge_due.
  finalCharge: FinalChargeDue | null;
}

const blocked = (
  blocker: MachineDeletionBlocker,
  message: string,
  details: Partial<MachineDeletionCheck> = {},
): MachineDeletionCheck => ({
  canDelete: false,
  blocker,
  message,
  finalInvoiceFrom: null,
  unpaidInvoices: [],
  monthsDue: [],
  finalCharge: null,
  ...details,
});

const ALLOWED: MachineDeletionCheck = {
  canDelete: true,
  blocker: null,
  message: null,
  finalInvoiceFrom: null,
  unpaidInvoices: [],
  monthsDue: [],
  finalCharge: null,
};

const previousMonthStart = (day: string): string =>
  firstDayOfMonth(addDaysToDay(firstDayOfMonth(day), -1));

export interface BilledMonthRange {
  firstMonth: string;
  // The newest month that has closed; before firstMonth if none has.
  lastClosedMonth: string;
  // The last month with anything to pay, closed or still open.
  lastMonth: string;
  // Still counted this month: today is before its billing_end.
  isCurrentMonthOpen: boolean;
  // The day after lastClosedMonth, the run's marker for having passed it.
  firstDayAfterClosed: string;
  billingEnd: string;
}

// The months a machine was billed for; null if it never was, or if an interval
// is still open.
export const billedMonthRange = (
  intervals: BillingIntervalUse[],
  today: string,
): BilledMonthRange | null => {
  if (intervals.length === 0) return null;
  if (intervals.some((interval) => interval.billingEnd === null)) return null;
  const billingEnd = intervals
    .map((interval) => interval.billingEnd as string)
    .reduce((a, b) => (a > b ? a : b));
  const firstMonth = firstDayOfMonth(
    intervals
      .map((interval) => interval.activatedOn)
      .reduce((a, b) => (a < b ? a : b)),
  );
  const isCurrentMonthOpen = today < billingEnd;
  const firstDayAfterClosed = isCurrentMonthOpen
    ? firstDayOfMonth(today)
    : billingEnd;
  const lastClosedMonth = previousMonthStart(firstDayAfterClosed);
  return {
    firstMonth,
    lastClosedMonth,
    lastMonth: isCurrentMonthOpen ? firstDayOfMonth(today) : lastClosedMonth,
    isCurrentMonthOpen,
    firstDayAfterClosed,
    billingEnd,
  };
};

// False for a gap between two periods of use, which has nothing to charge.
const wasBilledInMonth = (
  intervals: BillingIntervalUse[],
  month: string,
): boolean =>
  intervals.some(
    (interval) =>
      interval.activatedOn < firstDayOfNextMonth(month) &&
      (interval.billingEnd === null || interval.billingEnd > month),
  );

export const assessMachineDeletion = (
  facts: DeletionFacts,
): MachineDeletionCheck => {
  if (facts.state === 'active') {
    return blocked(
      'needs_deactivation',
      'Deactivate this machine first. You then pay for the days it was used and can delete it.',
    );
  }
  if (facts.state === 'sold') {
    return blocked(
      'sold',
      'This machine was sold or transferred, so it stays on record.',
    );
  }
  if (facts.hasPendingTransfer) {
    return blocked(
      'pending_transfer',
      'This machine has a transfer waiting for approval. Cancel it first.',
    );
  }
  if (facts.openCaseCount > 0) {
    return blocked(
      'open_cases',
      'Close the open support cases on this machine first.',
    );
  }
  const range = billedMonthRange(facts.intervals, facts.today);
  if (!range) return ALLOWED;

  const unpaid = facts.invoices.filter(
    (invoice) =>
      invoice.status !== 'paid' &&
      invoice.status !== 'void' &&
      invoice.totalExGstCents > 0,
  );
  if (unpaid.length > 0) {
    return blocked(
      'unpaid_invoices',
      'Pay the invoices below, then you can delete this machine.',
      {
        unpaidInvoices: unpaid.map((invoice) => ({
          id: invoice.id,
          periodStart: invoice.periodStart,
          status: invoice.status,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          isFinalCharge: invoice.isFinalCharge,
        })),
      },
    );
  }

  const isLastClosedDue =
    range.lastClosedMonth >= range.firstMonth &&
    wasBilledInMonth(facts.intervals, range.lastClosedMonth) &&
    !facts.runPassedLastClosedMonth &&
    !facts.finalChargedMonths.includes(range.lastClosedMonth) &&
    !facts.invoices.some(
      (invoice) =>
        !invoice.isFinalCharge && invoice.periodStart === range.lastClosedMonth,
    );

  if (facts.plan === 'monthly') {
    const isOpenMonthDue =
      range.isCurrentMonthOpen &&
      !facts.finalChargedMonths.includes(range.lastMonth);
    const monthsDue = [
      ...(isLastClosedDue ? [range.lastClosedMonth] : []),
      ...(isOpenMonthDue ? [range.lastMonth] : []),
    ];
    return monthsDue.length === 0
      ? ALLOWED
      : blocked(
          'final_charge_due',
          'Pay for the days this machine was used, then you can delete it.',
          { monthsDue },
        );
  }

  if (isLastClosedDue) {
    return blocked(
      'awaiting_final_invoice',
      "Last month's invoice hasn't been issued yet. It can be paid once it is, and then you can delete this machine.",
      { finalInvoiceFrom: range.firstDayAfterClosed },
    );
  }

  if (!range.isCurrentMonthOpen || facts.plan === 'none') return ALLOWED;
  return blocked(
    'awaiting_final_invoice',
    'This machine is on an annual plan, so it is settled at the end of this month. It can be deleted after that.',
    { finalInvoiceFrom: range.billingEnd },
  );
};

const daysBetween = (from: string, until: string): number =>
  Math.round(
    (Date.parse(`${until}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

// The daily-rate charge for the month `day` falls in: every day from its
// activation to the day it was deactivated, both counted, however many times.
export const quoteFinalCharge = (
  intervals: BillingIntervalUse[],
  day: string,
  monthlyRateCents: number,
): FinalChargeQuote => {
  const periodStart = firstDayOfMonth(day);
  const periodEnd = firstDayOfNextMonth(day);
  const days = new Set<string>();
  let lastUsedOn = periodStart;
  for (const interval of intervals) {
    const end = interval.billingEnd ?? periodEnd;
    if (end <= periodStart || interval.activatedOn >= periodEnd) continue;
    const from =
      interval.activatedOn > periodStart ? interval.activatedOn : periodStart;
    const candidate = interval.lastUsedOn ?? addDaysToDay(end, -1);
    const until =
      candidate < addDaysToDay(periodEnd, -1)
        ? candidate
        : addDaysToDay(periodEnd, -1);
    for (let day = from; day <= until; day = addDaysToDay(day, 1)) {
      days.add(day);
    }
    if (until > lastUsedOn) lastUsedOn = until;
  }
  const daysInMonth = daysBetween(periodStart, periodEnd);
  const daysUsed = Math.max(days.size, 1);
  return {
    periodStart,
    lastUsedOn,
    daysUsed,
    daysInMonth,
    monthlyRateCents,
    amountCents: divideRoundHalfUp(monthlyRateCents * daysUsed, daysInMonth),
  };
};
