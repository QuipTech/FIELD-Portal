import { PinnedPriceBook, RemoteBlockRules } from './pricingTypes';

// Version 1 of the price book and config as seeded by migration 0095, for
// the acceptance tests (spec section 10). Test data only.
export const ASSET_PRO_V1: PinnedPriceBook = {
  id: 'asset-pro-v1',
  planCode: 'ASSET_PRO',
  version: 1,
  effectiveFrom: '2026-01-01',
  unitCents: null,
  minimumAnnualCents: null,
  bands: [
    { bandNo: 1, lowerQty: 1, upperQty: 25, unitCents: 3500 },
    { bandNo: 2, lowerQty: 26, upperQty: 99, unitCents: 2900 },
    { bandNo: 3, lowerQty: 100, upperQty: 499, unitCents: 2500 },
  ],
};

export const TECH_SEAT_CENTS_V1 = 4900;
export const REMOTE_BLOCK_CENTS_V1 = 3500;
export const ENTERPRISE_MINIMUM_ANNUAL_CENTS_V1 = 500000;
export const ANNUAL_MONTHS_CHARGED = 10;
export const ENTERPRISE_THRESHOLD_MACHINES = 500;

export const REMOTE_RULES: RemoteBlockRules = {
  blockMinutes: 15,
  minSeconds: 120,
};
