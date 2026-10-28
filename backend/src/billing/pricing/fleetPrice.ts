import { PriceBand } from './pricingTypes';

const assertMachineCount = (machineCount: number) => {
  if (!Number.isSafeInteger(machineCount) || machineCount < 0) {
    throw new RangeError('machineCount must be a non-negative whole number');
  }
};

// rate(n): the rate of the band n falls in. Above the top band's upper
// limit the top band's rate still applies (spec decision: a self-serve
// account past the Enterprise threshold keeps billing and raises a sales
// task instead).
export const findBandRateCents = (
  bands: PriceBand[],
  machineCount: number,
): number => {
  assertMachineCount(machineCount);
  if (bands.length === 0) {
    throw new RangeError('The price book has no bands');
  }
  const sorted = [...bands].sort((a, b) => a.bandNo - b.bandNo);
  const band = sorted.find(
    (candidate) =>
      machineCount >= candidate.lowerQty &&
      (candidate.upperQty === null || machineCount <= candidate.upperQty),
  );
  if (band) return band.unitCents;

  const topBand = sorted[sorted.length - 1];
  if (topBand.upperQty !== null && machineCount > topBand.upperQty) {
    return topBand.unitCents;
  }
  throw new RangeError(`No price band covers ${machineCount} machines`);
};

// price(n) = n × rate(n): the whole fleet at its band's rate, no minimum.
export const calculateFleetPriceCents = (
  bands: PriceBand[],
  machineCount: number,
): number => {
  assertMachineCount(machineCount);
  if (machineCount === 0) return 0;
  return machineCount * findBandRateCents(bands, machineCount);
};
