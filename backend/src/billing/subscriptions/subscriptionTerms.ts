import {
  addDaysToDay,
  addMonthsToDay,
  firstDayOfMonth,
  firstDayOfNextMonth,
} from '../billingCalendar/billingDay';
import {
  CancellationPlan,
  Subscription,
  SubscriptionTermPlan,
} from './subscriptionTypes';

const MONTHS_IN_ANNUAL_TERM = 12;

const assertCommittedQty = (committedQty: number) => {
  if (!Number.isSafeInteger(committedQty) || committedQty <= 0) {
    throw new RangeError('The committed quantity must be a positive number');
  }
};

// Monthly: the calendar month containing `today`, no lock-in.
export const planMonthlyTerm = (
  today: string,
  priceBookId: string,
): SubscriptionTermPlan => ({
  term: 'monthly',
  priceBookId,
  periodStart: firstDayOfMonth(today),
  periodEnd: firstDayOfNextMonth(today),
  committedQty: null,
  annualMonthsCharged: null,
});

// Annual prepaid: 12 months from `startDay`, committing to Q machines (or
// seats). monthsCharged is pinned so a later config change can't re-price
// the term.
export const planAnnualTerm = (
  startDay: string,
  priceBookId: string,
  committedQty: number,
  monthsCharged: number,
): SubscriptionTermPlan => {
  assertCommittedQty(committedQty);
  return {
    term: 'annual',
    priceBookId,
    periodStart: startDay,
    periodEnd: addMonthsToDay(startDay, MONTHS_IN_ANNUAL_TERM),
    committedQty,
    annualMonthsCharged: monthsCharged,
  };
};

export interface RenewalInputs {
  priceBookInEffectId: string;
  currentCount: number;
  requestedQty: number | null;
  monthsCharged: number;
}

// The next term re-pins the price book in effect at renewal (T27). It is
// the term the customer chose for next time (monthly ↔ annual), else the
// same term again. Annual Q is the customer's choice, else it resets to
// the current count; a count of 0 still commits to 1, since a term needs a
// commitment.
export const planRenewal = (
  subscription: Subscription,
  inputs: RenewalInputs,
): SubscriptionTermPlan => {
  const nextStart = subscription.currentPeriodEnd;
  const nextTerm = subscription.nextTerm ?? subscription.term;
  if (nextTerm === 'monthly') {
    return planMonthlyTerm(nextStart, inputs.priceBookInEffectId);
  }
  return planAnnualTerm(
    nextStart,
    inputs.priceBookInEffectId,
    inputs.requestedQty ??
      subscription.nextCommittedQty ??
      Math.max(inputs.currentCount, 1),
    inputs.monthsCharged,
  );
};

// Cancelling takes effect at the end of the current period (the month for
// monthly, the prepaid term for annual). Export stays available, then the
// data is scheduled for deletion, both counted from that day.
export const planCancellation = (
  subscription: Subscription,
  exportDays: number,
  deleteDays: number,
): CancellationPlan => {
  const cancelAt = subscription.currentPeriodEnd;
  return {
    cancelAt,
    exportUntil: addDaysToDay(cancelAt, exportDays),
    deleteAfter: addDaysToDay(cancelAt, deleteDays),
  };
};
