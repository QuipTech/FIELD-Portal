import {
  calculateFleetPriceCents,
  findBandRateCents,
} from '../billing/pricing/fleetPrice';
import { PriceBand } from '../billing/pricing/pricingTypes';

export interface ActivationQuoteInput {
  bands: PriceBand[];
  // Machines active today, and the most active on any day this month.
  activeToday: number;
  peakSoFar: number;
  // Machines being activated.
  adding: number;
}

export interface ActivationQuoteAmounts {
  machinesAfter: number;
  // This month's billable machines: the month's peak (spec section 3).
  billableBefore: number;
  billableAfter: number;
  rateBeforeCents: number | null;
  rateAfterCents: number;
  monthlyBeforeCents: number;
  monthlyAfterCents: number;
}

// Pure: what activating `adding` machines does to this month's ASSET_PRO
// charge. The whole fleet is charged at the rate of its band, so crossing
// a band lowers every machine's rate.
export const quoteActivation = ({
  bands,
  activeToday,
  peakSoFar,
  adding,
}: ActivationQuoteInput): ActivationQuoteAmounts => {
  const machinesAfter = activeToday + adding;
  const billableAfter = Math.max(peakSoFar, machinesAfter);
  return {
    machinesAfter,
    billableBefore: peakSoFar,
    billableAfter,
    rateBeforeCents: peakSoFar > 0 ? findBandRateCents(bands, peakSoFar) : null,
    rateAfterCents: findBandRateCents(bands, billableAfter),
    monthlyBeforeCents: calculateFleetPriceCents(bands, peakSoFar),
    monthlyAfterCents: calculateFleetPriceCents(bands, billableAfter),
  };
};
