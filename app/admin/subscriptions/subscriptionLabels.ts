import type { Tone } from "@/components/ui/tone";
import { daysBetweenCalendarDates, formatCalendarDate } from "@/lib/format/calendarDate";
import type {
  BillingBasis,
  SubscriptionStatus,
  SubscriptionTier,
  TenantSubscription,
} from "@/lib/types/tenantSubscription";

export const TIER_OPTIONS: { value: SubscriptionTier; label: string; tone: Tone }[] = [
  { value: "standard", label: "Standard", tone: "primary" },
  { value: "enterprise", label: "Enterprise", tone: "default" },
  { value: "pilot", label: "Pilot", tone: "amber" },
  { value: "demo", label: "Demo", tone: "primary" },
];

export const BILLING_BASIS_OPTIONS: { value: BillingBasis; label: string }[] = [
  { value: "per_asset", label: "Per asset" },
  { value: "negotiated", label: "Negotiated" },
  { value: "fixed_fee", label: "Fixed fee" },
];

export const STATUS_OPTIONS: { value: SubscriptionStatus; label: string; tone: Tone }[] = [
  { value: "active", label: "Active", tone: "ok" },
  { value: "expiring_soon", label: "Expiring soon", tone: "amber" },
  { value: "expired", label: "Expired", tone: "danger" },
  { value: "not_set_up", label: "Not set up", tone: "default" },
];

export const getTierOption = (tier: SubscriptionTier) => TIER_OPTIONS.find((option) => option.value === tier)!;
export const getStatusOption = (status: SubscriptionStatus) =>
  STATUS_OPTIONS.find((option) => option.value === status)!;

// 3100 → "3.1k", 20000 → "20k", 890 → "890".
const formatCompact = (value: number): string =>
  value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(value);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// "Per asset · 42", "Negotiated · 210 assets", "Fixed fee · 60 day".
export const describeBillingBasis = ({ subscription, assetCount }: TenantSubscription): string => {
  if (!subscription?.billingBasis) return "—";
  switch (subscription.billingBasis) {
    case "per_asset":
      return `Per asset · ${assetCount}`;
    case "negotiated":
      return `Negotiated · ${plural(subscription.licensedAssets ?? 0, "asset")}`;
    case "fixed_fee":
      return subscription.endsOn
        ? `Fixed fee · ${daysBetweenCalendarDates(subscription.startsOn, subscription.endsOn)} day`
        : "Fixed fee";
  }
};

// Queries this calendar month against the monthly allowance.
export const describeAiUsage = ({ subscription, status, aiQueriesThisMonth }: TenantSubscription): string => {
  if (!subscription) return "—";
  if (subscription.tier === "demo") return "Synthetic data";
  if (status === "expired") return "— qry";
  const allowance = subscription.aiMonthlyQueryAllowance;
  return allowance === null
    ? `${formatCompact(aiQueriesThisMonth)} qry`
    : `${formatCompact(aiQueriesThisMonth)} / ${formatCompact(allowance)} qry`;
};

export const describeAddOns = ({ subscription }: TenantSubscription): string => {
  if (!subscription) return "—";
  const addOns = [
    subscription.wearableSeats ? plural(subscription.wearableSeats, "wearable seat") : null,
    subscription.remoteExpertSeats ? `${subscription.remoteExpertSeats} remote expert` : null,
    subscription.ssoEnabled ? "SSO" : null,
  ].filter(Boolean);
  return addOns.length ? addOns.join(" · ") : "No add-ons";
};

export const describeRenewal = ({ subscription, status }: TenantSubscription): string => {
  if (!subscription) return "—";
  if (!subscription.endsOn) return "No end date";
  const date = formatCalendarDate(subscription.endsOn);
  return status === "expired" ? `Expired ${date}` : date;
};
