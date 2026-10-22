import { PriceBand } from './pricingTypes';

// A price book's bands must cover every count from 1 upward with no gap
// or overlap, so rate(n) always has exactly one answer. Returns the
// problems found (empty = valid), for the price book editor to show.
export const findPriceBandProblems = (bands: PriceBand[]): string[] => {
  if (bands.length === 0) return ['At least one band is required.'];
  const problems: string[] = [];
  const sorted = [...bands].sort((a, b) => a.bandNo - b.bandNo);

  if (sorted[0].lowerQty !== 1) {
    problems.push('The first band must start at 1 machine.');
  }
  sorted.forEach((band, index) => {
    if (!Number.isSafeInteger(band.unitCents) || band.unitCents < 0) {
      problems.push(`Band ${band.bandNo}: the rate must be whole cents.`);
    }
    if (band.upperQty !== null && band.upperQty < band.lowerQty) {
      problems.push(`Band ${band.bandNo}: the upper limit is below the lower.`);
    }
    const next = sorted[index + 1];
    if (!next) return;
    if (band.upperQty === null) {
      problems.push(
        `Band ${band.bandNo}: only the last band can be open-ended.`,
      );
    } else if (next.lowerQty !== band.upperQty + 1) {
      problems.push(
        `Band ${next.bandNo} must start at ${band.upperQty + 1} machines.`,
      );
    }
  });
  return problems;
};
