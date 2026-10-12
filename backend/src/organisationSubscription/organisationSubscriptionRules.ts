import { toIsoDay } from '../common/utils/toIsoDay';
import {
  daysBetween,
  deriveSubscriptionStatus,
} from '../adminSubscriptions/subscriptionRules';
import { BillingBasis } from '../adminSubscriptions/types/subscriptionResponse';
import {
  OrganisationSubscription,
  OrganisationSubscriptionRow,
} from './types/organisationSubscriptionResponse';

// Matches app.sync_entitlements(): these Stripe states switch features off.
const LAPSED_STRIPE_STATUSES = ['canceled', 'unpaid', 'incomplete_expired'];

const FREE_PLAN = { planCode: 'free', planName: 'Free' };

const isLapsed = (row: OrganisationSubscriptionRow, today: string): boolean => {
  if (row.stripe_status && LAPSED_STRIPE_STATUSES.includes(row.stripe_status)) {
    return true;
  }
  return row.ends_on !== null && daysBetween(today, toIsoDay(row.ends_on)) < 0;
};

export const toOrganisationSubscription = (
  row: OrganisationSubscriptionRow,
  today: string,
): OrganisationSubscription => {
  const assetCount = Number(row.asset_count);
  const planName = row.plan_name ?? row.tier;

  if (!row.tier || isLapsed(row, today)) {
    return {
      status: 'free',
      ...FREE_PLAN,
      billingBasis: null,
      licensedAssets: null,
      endsOn: null,
      renewsAutomatically: false,
      lapsedPlanName: row.tier ? planName : null,
      assetCount,
    };
  }

  const endsOn = row.ends_on ? toIsoDay(row.ends_on) : null;
  const daysUntilEnd = endsOn ? daysBetween(today, endsOn) : null;
  return {
    status: deriveSubscriptionStatus(true, daysUntilEnd) as
      'active' | 'expiring_soon',
    planCode: row.tier,
    planName: planName ?? row.tier,
    billingBasis: row.billing_basis as BillingBasis | null,
    licensedAssets: row.licensed_assets,
    endsOn,
    renewsAutomatically: row.source === 'stripe',
    lapsedPlanName: null,
    assetCount,
  };
};
