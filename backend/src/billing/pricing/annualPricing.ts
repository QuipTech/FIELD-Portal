import { calculateFleetPriceCents } from './fleetPrice';
import { PriceBand } from './pricingTypes';
import { divideRoundHalfUp } from './roundHalfUp';

const MONTHS_IN_TERM = 12;

// Annual prepaid ASSET_PRO: price(Q) × ANNUAL_MONTHS_CHARGED, paid up front
// for the 12-month term.
export const calculateAnnualUpFrontCents = (
  bands: PriceBand[],
  committedQty: number,
  monthsCharged: number,
): number => calculateFleetPriceCents(bands, committedQty) * monthsCharged;

// ASSET_PRO_OVER_COMMIT for a month whose peak passed Q:
// (price(peak) − price(Q)) × monthsCharged / 12, rounded half-up to the
// cent. At or below Q there is nothing to add (and no refund). A peak just
// past a band boundary can price below Q (price(26) < price(25)); that is
// also never a refund, so the charge floors at 0.
export const calculateOverCommitCents = (
  bands: PriceBand[],
  peakQty: number,
  committedQty: number,
  monthsCharged: number,
): number => {
  if (peakQty <= committedQty) return 0;
  const monthlyDifference =
    calculateFleetPriceCents(bands, peakQty) -
    calculateFleetPriceCents(bands, committedQty);
  if (monthlyDifference <= 0) return 0;
  return divideRoundHalfUp(monthlyDifference * monthsCharged, MONTHS_IN_TERM);
};
