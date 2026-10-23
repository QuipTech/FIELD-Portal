import { PinnedPriceBook, PriceBand } from '../pricing/pricingTypes';
import { SubscriptionTerm } from '../subscriptions/subscriptionTypes';

// One snapshot row: what was billable on one billing day.
export interface DailyBillableCount {
  day: string;
  activeMachines: number;
  techSeats: number;
}

// The month's peak and the first day it was reached.
export interface MonthlyPeak {
  count: number;
  day: string | null;
}

// A subscription that was live during the month, with its pinned book.
export interface RunSubscription {
  id: string;
  planCode: string;
  term: SubscriptionTerm;
  committedQty: number | null;
  annualMonthsCharged: number | null;
  book: PinnedPriceBook;
}

export type LineFormula =
  'ASSET_PRO' | 'ASSET_PRO_OVER_COMMIT' | 'TECH' | 'TECH_EXTRA_SEATS';

// Everything a line's amount depends on, stored with the line so it can be
// recalculated to the cent without reading anything else (T31).
export interface LineCalcSnapshot {
  formula: LineFormula;
  subscriptionId: string;
  periodStart: string;
  periodEnd: string;
  peak: number;
  peakDay: string | null;
  priceBookId: string;
  priceBookVersion: number;
  bands: PriceBand[];
  seatCents: number | null;
  committedQty: number | null;
  monthsCharged: number | null;
}

export interface CalculatedLine {
  lineType: string;
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
  calcSnapshot: LineCalcSnapshot;
}
