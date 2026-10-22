// Inputs to the pure pricing functions. Every number comes from the price
// book pinned to the subscription or from billing.config — never a
// literal in the calculation.

export interface PriceBand {
  bandNo: number;
  lowerQty: number;
  // null = no upper bound.
  upperQty: number | null;
  unitCents: number;
}

export interface PinnedPriceBook {
  id: string;
  planCode: string;
  version: number;
  effectiveFrom: string;
  unitCents: number | null;
  minimumAnnualCents: number | null;
  // Ascending by band_no; empty for flat-priced plans.
  bands: PriceBand[];
}

export interface RemoteBlockRules {
  blockMinutes: number;
  minSeconds: number;
}

export interface RemoteSessionCharge {
  // Every session is metered, so the duration is always kept.
  durationSeconds: number;
  billableBlocks: number;
  amountCents: number;
}
