import type { OrganisationSubscription } from "../types/organisationSubscription";
import type { BillingBasis } from "../types/tenantSubscription";

const BILLING_BASIS_LABELS: Record<BillingBasis, string> = {
  per_asset: "Billed per asset, monthly",
  negotiated: "Negotiated contract",
  fixed_fee: "Fixed fee",
};

const pluralise = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

// "Billed per asset, monthly · 42 assets", or why the plan is free.
export const formatSubscriptionCaption = (subscription: OrganisationSubscription): string => {
  if (subscription.status === "free") {
    return subscription.lapsedPlanName
      ? `Your ${subscription.lapsedPlanName} plan has ended · upgrade to restore paid features`
      : "No paid subscription · upgrade to unlock the full platform";
  }
  const assets =
    subscription.billingBasis === "negotiated" && subscription.licensedAssets !== null
      ? `${pluralise(subscription.licensedAssets, "licensed asset")}`
      : pluralise(subscription.assetCount, "asset");
  const basis = subscription.billingBasis ? BILLING_BASIS_LABELS[subscription.billingBasis] : null;
  return [basis, assets].filter(Boolean).join(" · ");
};
