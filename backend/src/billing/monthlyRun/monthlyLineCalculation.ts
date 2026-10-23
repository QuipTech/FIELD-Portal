import { calculateOverCommitCents } from '../pricing/annualPricing';
import {
  calculateFleetPriceCents,
  findBandRateCents,
} from '../pricing/fleetPrice';
import {
  calculateTechExtraSeatUnitCents,
  calculateTechMonthlyCents,
} from '../pricing/techPricing';
import {
  CalculatedLine,
  DailyBillableCount,
  LineCalcSnapshot,
  MonthlyPeak,
  RunSubscription,
} from './monthlyRunTypes';

// Monthly run, step 2 (billing spec section 9): turns a closing month's
// daily snapshots and the account's subscriptions into invoice lines, all
// in arrears. Pure: every price comes from the subscription's pinned book.

interface MonthlyRunInput {
  periodStart: string;
  periodEnd: string;
  counts: DailyBillableCount[];
  subscriptions: RunSubscription[];
}

// The highest count on any one day; ties keep the earliest day.
export const findMonthlyPeak = (
  counts: DailyBillableCount[],
  pick: (count: DailyBillableCount) => number,
): MonthlyPeak =>
  counts.reduce<MonthlyPeak>(
    (peak, count) =>
      pick(count) > peak.count ? { count: pick(count), day: count.day } : peak,
    { count: 0, day: null },
  );

// The amount a snapshot describes; a stored line must always equal this.
export const recalculateLineAmountCents = (
  snapshot: LineCalcSnapshot,
): number => {
  switch (snapshot.formula) {
    case 'ASSET_PRO':
      return calculateFleetPriceCents(snapshot.bands, snapshot.peak);
    case 'ASSET_PRO_OVER_COMMIT':
      return calculateOverCommitCents(
        snapshot.bands,
        snapshot.peak,
        snapshot.committedQty ?? 0,
        snapshot.monthsCharged ?? 0,
      );
    case 'TECH':
      return calculateTechMonthlyCents(snapshot.peak, snapshot.seatCents ?? 0);
    case 'TECH_EXTRA_SEATS':
      return (
        (snapshot.peak - (snapshot.committedQty ?? 0)) *
        calculateTechExtraSeatUnitCents(
          snapshot.seatCents ?? 0,
          snapshot.monthsCharged ?? 0,
        )
      );
  }
};

const toSnapshot = (
  input: MonthlyRunInput,
  subscription: RunSubscription,
  formula: LineCalcSnapshot['formula'],
  peak: MonthlyPeak,
): LineCalcSnapshot => ({
  formula,
  subscriptionId: subscription.id,
  periodStart: input.periodStart,
  periodEnd: input.periodEnd,
  peak: peak.count,
  peakDay: peak.day,
  priceBookId: subscription.book.id,
  priceBookVersion: subscription.book.version,
  bands: subscription.book.bands,
  seatCents: subscription.book.unitCents,
  committedQty: subscription.committedQty,
  monthsCharged: subscription.annualMonthsCharged,
});

const assetProLine = (
  input: MonthlyRunInput,
  subscription: RunSubscription,
  peak: MonthlyPeak,
): CalculatedLine | null => {
  if (subscription.term === 'monthly') {
    if (peak.count === 0) return null;
    const unitCents = findBandRateCents(subscription.book.bands, peak.count);
    return {
      lineType: 'ASSET_PRO',
      description: `FIELD Asset Professional, month from ${input.periodStart}: peak ${peak.count} active machines`,
      quantity: peak.count,
      unitCents,
      amountCents: peak.count * unitCents,
      calcSnapshot: toSnapshot(input, subscription, 'ASSET_PRO', peak),
    };
  }
  const snapshot = toSnapshot(
    input,
    subscription,
    'ASSET_PRO_OVER_COMMIT',
    peak,
  );
  const amountCents = recalculateLineAmountCents(snapshot);
  if (amountCents === 0) return null;
  return {
    lineType: 'ASSET_PRO_OVER_COMMIT',
    description: `FIELD Asset Professional over commitment, month from ${input.periodStart}: peak ${peak.count} above ${subscription.committedQty} committed`,
    quantity: 1,
    unitCents: amountCents,
    amountCents,
    calcSnapshot: snapshot,
  };
};

const techLine = (
  input: MonthlyRunInput,
  subscription: RunSubscription,
  peak: MonthlyPeak,
): CalculatedLine | null => {
  const seatCents = subscription.book.unitCents ?? 0;
  if (subscription.term === 'monthly') {
    if (peak.count === 0) return null;
    return {
      lineType: 'TECH',
      description: `FIELD Technician, month from ${input.periodStart}: peak ${peak.count} seats`,
      quantity: peak.count,
      unitCents: seatCents,
      amountCents: calculateTechMonthlyCents(peak.count, seatCents),
      calcSnapshot: toSnapshot(input, subscription, 'TECH', peak),
    };
  }
  const extraSeats = peak.count - (subscription.committedQty ?? 0);
  if (extraSeats <= 0) return null;
  const unitCents = calculateTechExtraSeatUnitCents(
    seatCents,
    subscription.annualMonthsCharged ?? 0,
  );
  return {
    lineType: 'TECH',
    description: `FIELD Technician extra seats, month from ${input.periodStart}: ${extraSeats} above ${subscription.committedQty} committed`,
    quantity: extraSeats,
    unitCents,
    amountCents: extraSeats * unitCents,
    calcSnapshot: toSnapshot(input, subscription, 'TECH_EXTRA_SEATS', peak),
  };
};

// Enterprise contracts, internal accounts and one-off plans are invoiced
// elsewhere, so they add nothing here.
export const calculateMonthlyLines = (
  input: MonthlyRunInput,
): CalculatedLine[] => {
  const machinePeak = findMonthlyPeak(input.counts, (c) => c.activeMachines);
  const seatPeak = findMonthlyPeak(input.counts, (c) => c.techSeats);
  return input.subscriptions
    .map((subscription) => {
      if (subscription.planCode === 'ASSET_PRO')
        return assetProLine(input, subscription, machinePeak);
      if (subscription.planCode === 'TECH')
        return techLine(input, subscription, seatPeak);
      return null;
    })
    .filter((line): line is CalculatedLine => line !== null);
};
