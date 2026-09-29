import type {
  BillingBasis,
  SubscriptionPayload,
  SubscriptionTier,
  TenantSubscription,
} from "@/lib/types/tenantSubscription";

// The editor's form state; number fields stay strings while typing.
export interface SubscriptionFormState {
  tier: SubscriptionTier;
  billingBasis: BillingBasis | "";
  licensedAssets: string;
  startsOn: string;
  endsOn: string;
  aiMonthlyQueryAllowance: string;
  wearableSeats: string;
  remoteExpertSeats: string;
  ssoEnabled: boolean;
  notes: string;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// A new subscription defaults to a year of Standard, billed per asset.
export const toFormState = ({ subscription }: TenantSubscription): SubscriptionFormState => {
  if (!subscription) {
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setUTCFullYear(today.getUTCFullYear() + 1);
    return {
      tier: "standard",
      billingBasis: "per_asset",
      licensedAssets: "",
      startsOn: isoDay(today),
      endsOn: isoDay(nextYear),
      aiMonthlyQueryAllowance: "",
      wearableSeats: "0",
      remoteExpertSeats: "0",
      ssoEnabled: false,
      notes: "",
    };
  }
  return {
    tier: subscription.tier,
    billingBasis: subscription.billingBasis ?? "",
    licensedAssets: subscription.licensedAssets?.toString() ?? "",
    startsOn: subscription.startsOn,
    endsOn: subscription.endsOn ?? "",
    aiMonthlyQueryAllowance: subscription.aiMonthlyQueryAllowance?.toString() ?? "",
    wearableSeats: String(subscription.wearableSeats),
    remoteExpertSeats: String(subscription.remoteExpertSeats),
    ssoEnabled: subscription.ssoEnabled,
    notes: subscription.notes ?? "",
  };
};

const toCount = (value: string): number | null => (value.trim() === "" ? null : Number(value));

// The backend re-checks every rule; this only shapes the request.
export const toPayload = (form: SubscriptionFormState): SubscriptionPayload => ({
  tier: form.tier,
  billingBasis: form.billingBasis || null,
  licensedAssets: form.billingBasis === "negotiated" ? toCount(form.licensedAssets) : null,
  startsOn: form.startsOn,
  endsOn: form.endsOn || null,
  aiMonthlyQueryAllowance: toCount(form.aiMonthlyQueryAllowance),
  wearableSeats: toCount(form.wearableSeats) ?? 0,
  remoteExpertSeats: toCount(form.remoteExpertSeats) ?? 0,
  ssoEnabled: form.ssoEnabled,
  notes: form.notes.trim() || null,
});
