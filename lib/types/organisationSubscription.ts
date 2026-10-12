import type { BillingBasis } from "./tenantSubscription";

// "free" covers no subscription, one that ended, and one Stripe cancelled.
export type OrganisationPlanStatus = "active" | "expiring_soon" | "free";

export interface OrganisationSubscription {
  status: OrganisationPlanStatus;
  // "free" / "Free" on the free plan.
  planCode: string;
  planName: string;
  billingBasis: BillingBasis | null;
  licensedAssets: number | null;
  // YYYY-MM-DD; null on the free plan or a term with no end date.
  endsOn: string | null;
  // Stripe-managed plans renew on endsOn; manual contracts simply end.
  renewsAutomatically: boolean;
  // The paid plan that lapsed into the free plan, if any.
  lapsedPlanName: string | null;
  assetCount: number;
}
