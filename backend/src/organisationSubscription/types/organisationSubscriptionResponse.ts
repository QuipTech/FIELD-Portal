import { BillingBasis } from '../../adminSubscriptions/types/subscriptionResponse';

// 'free' covers no subscription, one that ended, and one Stripe cancelled.
export type OrganisationPlanStatus = 'active' | 'expiring_soon' | 'free';

export interface OrganisationSubscription {
  status: OrganisationPlanStatus;
  // 'free' / 'Free' on the free plan, otherwise the platform.plans entry.
  planCode: string;
  planName: string;
  billingBasis: BillingBasis | null;
  licensedAssets: number | null;
  // YYYY-MM-DD; null on the free plan or a term with no end date.
  endsOn: string | null;
  // Stripe-managed plans renew on endsOn; manual contracts simply end.
  renewsAutomatically: boolean;
  // The plan that lapsed, so the page can say what the free plan replaced.
  lapsedPlanName: string | null;
  assetCount: number;
}

// One row of findOrganisationSubscription(); subscription columns are null
// when the organisation has none. bigint arrives from pg as a string.
export interface OrganisationSubscriptionRow {
  tier: string | null;
  plan_name: string | null;
  billing_basis: string | null;
  licensed_assets: number | null;
  ends_on: Date | null;
  source: 'manual' | 'stripe' | null;
  stripe_status: string | null;
  asset_count: string;
}
