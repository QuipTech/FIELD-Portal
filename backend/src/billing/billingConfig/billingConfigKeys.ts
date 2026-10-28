// The billing.config keys (spec section 11) and the shape each value must
// have. Values live only in the database (seeded by migration 0095), so a
// change needs no deploy. Section 11's prices — the ASSET_PRO bands and
// rates, TECH_PRICE_CENTS, REMOTE_BLOCK_CENTS, ONBOARD_ASSISTED_CENTS and
// ENTERPRISE_MIN_ANNUAL_CENTS — are in the versioned price book instead,
// so they can be pinned to a subscription.

export type BillingConfigValueKind =
  | 'positiveInteger'
  | 'nonNegativeInteger'
  | 'ratio'
  | 'optionalPositiveNumber'
  | 'timeZone';

export const BILLING_CONFIG_KEYS = {
  ENTERPRISE_THRESHOLD_MACHINES: 'positiveInteger',
  ANNUAL_MONTHS_CHARGED: 'positiveInteger',
  REMOTE_BLOCK_MINUTES: 'positiveInteger',
  REMOTE_MIN_SECONDS: 'nonNegativeInteger',
  AI_ALLOWANCE_PER_ACTIVE_MACHINE: 'nonNegativeInteger',
  AI_ALLOWANCE_PER_TECH_USER: 'nonNegativeInteger',
  AI_NOTIFY_THRESHOLD: 'ratio',
  AI_FLAG_THRESHOLD: 'ratio',
  AI_ABUSE_CEILING_MULTIPLIER: 'optionalPositiveNumber',
  STORAGE_ALLOWANCE_PER_ACTIVE_MACHINE: 'nonNegativeInteger',
  INGEST_ALLOWANCE: 'nonNegativeInteger',
  PARTNER_DEFAULT_MARGIN_BPS: 'nonNegativeInteger',
  PAYMENT_TERMS_DAYS: 'positiveInteger',
  INVOICE_REVIEW_HOURS: 'nonNegativeInteger',
  DEFAULT_BILLING_TIMEZONE: 'timeZone',
  CANCEL_EXPORT_DAYS: 'positiveInteger',
  CANCEL_DELETE_DAYS: 'positiveInteger',
  SUSPENSION_NOTICE_DAYS: 'positiveInteger',
} as const satisfies Record<string, BillingConfigValueKind>;

export type BillingConfigKey = keyof typeof BILLING_CONFIG_KEYS;

type ValueOfKind<Kind extends BillingConfigValueKind> = Kind extends 'timeZone'
  ? string
  : Kind extends 'optionalPositiveNumber'
    ? number | null
    : number;

export type BillingConfig = {
  [Key in BillingConfigKey]: ValueOfKind<(typeof BILLING_CONFIG_KEYS)[Key]>;
};

export interface BillingConfigEntry {
  key: BillingConfigKey;
  value: number | string | null;
  isFinal: boolean;
  description: string;
  updatedAt: string;
}
