import type { Tone } from "@/components/ui/tone";

export type TenantTier = "Standard" | "Enterprise" | "Pilot" | "Demo";
export type TenantStatus = "Active" | "Expiring soon" | "Expired";

export interface TenantSubscription {
  id: string;
  initials: string;
  company: string;
  tier: TenantTier;
  billingBasis: string;
  aiUsage: string;
  addOns: string;
  renewsLabel: string;
  status: TenantStatus;
  canNotify: boolean;
}

export const tenantTierTone: Record<TenantTier, Tone> = {
  Standard: "primary",
  Enterprise: "default",
  Pilot: "amber",
  Demo: "primary",
};

export const tenantStatusTone: Record<TenantStatus, Tone> = {
  Active: "ok",
  "Expiring soon": "amber",
  Expired: "danger",
};

export const tenantSubscriptions: TenantSubscription[] = [
  {
    id: "1",
    initials: "QM",
    company: "QuipTech Mining",
    tier: "Standard",
    billingBasis: "Per asset · 42",
    aiUsage: "3.1k / 4k qry",
    addOns: "6 wearable seats · 2 remote expert",
    renewsLabel: "14 Apr 2027",
    status: "Active",
    canNotify: false,
  },
  {
    id: "2",
    initials: "NR",
    company: "Norrison Resources",
    tier: "Enterprise",
    billingBasis: "Negotiated · 210 assets",
    aiUsage: "18.4k / 20k qry",
    addOns: "40 wearable seats · SSO",
    renewsLabel: "2 May 2027",
    status: "Active",
    canNotify: false,
  },
  {
    id: "3",
    initials: "BP",
    company: "Baxley Plant Co.",
    tier: "Pilot",
    billingBasis: "Fixed fee · 60 day",
    aiUsage: "890 / 1k qry",
    addOns: "2 wearable seats",
    renewsLabel: "22 Mar 2027",
    status: "Expiring soon",
    canNotify: true,
  },
  {
    id: "4",
    initials: "DK",
    company: "Dunkerra Quarries",
    tier: "Standard",
    billingBasis: "Per asset · 18",
    aiUsage: "1.2k / 1.5k qry",
    addOns: "No add-ons",
    renewsLabel: "3 Mar 2027",
    status: "Expiring soon",
    canNotify: true,
  },
  {
    id: "5",
    initials: "HS",
    company: "Halden Steel Group",
    tier: "Standard",
    billingBasis: "Per asset · 27",
    aiUsage: "— qry",
    addOns: "1 wearable seat",
    renewsLabel: "Expired 8 Feb 2027",
    status: "Expired",
    canNotify: true,
  },
  {
    id: "6",
    initials: "VF",
    company: "Vantree Freight",
    tier: "Demo",
    billingBasis: "—",
    aiUsage: "Synthetic data",
    addOns: "No add-ons",
    renewsLabel: "No end date",
    status: "Active",
    canNotify: false,
  },
];
