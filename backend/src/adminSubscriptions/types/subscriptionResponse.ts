export const SUBSCRIPTION_TIERS = [
  'standard',
  'enterprise',
  'pilot',
  'demo',
] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const BILLING_BASES = ['per_asset', 'negotiated', 'fixed_fee'] as const;
export type BillingBasis = (typeof BILLING_BASES)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'expiring_soon',
  'expired',
  'not_set_up',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface SubscriptionTerms {
  tier: SubscriptionTier;
  billingBasis: BillingBasis | null;
  licensedAssets: number | null;
  // YYYY-MM-DD; endsOn null = no end date.
  startsOn: string;
  endsOn: string | null;
  aiMonthlyQueryAllowance: number | null;
  wearableSeats: number;
  remoteExpertSeats: number;
  ssoEnabled: boolean;
  notes: string | null;
  updatedAt: string;
}

export interface TenantSubscription {
  tenantId: string;
  tenantName: string;
  status: SubscriptionStatus;
  // Days until endsOn (negative once past); null without an end date.
  daysUntilEnd: number | null;
  // null until the organisation's subscription is set up.
  subscription: SubscriptionTerms | null;
  assetCount: number;
  aiQueriesThisMonth: number;
}

export interface TenantSubscriptionList {
  items: TenantSubscription[];
  total: number;
  statusCounts: Record<SubscriptionStatus, number>;
}
