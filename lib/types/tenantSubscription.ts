export type SubscriptionTier = "standard" | "enterprise" | "pilot" | "demo";
export type BillingBasis = "per_asset" | "negotiated" | "fixed_fee";
export type SubscriptionStatus = "active" | "expiring_soon" | "expired" | "not_set_up";

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

// The whole subscription; omitted optional fields are cleared.
export type SubscriptionPayload = Omit<SubscriptionTerms, "updatedAt">;
