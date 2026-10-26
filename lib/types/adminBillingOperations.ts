// Platform admin billing operations. Amounts are AUD cents.

export interface CreditNote {
  id: string;
  invoiceId: string;
  // GST included: what the customer gets back.
  amountCents: number;
  reason: string;
  status: "pending" | "issued";
  stripeCreditNoteId: string | null;
  createdAt: string;
}

export interface OnboardingJob {
  id: string;
  billingAccountId: string;
  accountName: string;
  siteName: string;
  status: "scheduled" | "completed" | "waived";
  invoiceId: string | null;
  waivedReason: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PriceBand {
  bandNo: number;
  lowerQty: number;
  upperQty: number | null;
  unitCents: number;
}

export interface PriceBook {
  id: string;
  planCode: string;
  planName: string;
  version: number;
  effectiveFrom: string;
  unitCents: number | null;
  minimumAnnualCents: number | null;
  bands: PriceBand[];
  subscriptionCount: number;
  isInEffect: boolean;
}

export interface NewPriceBook {
  planCode: string;
  effectiveFrom: string;
  unitCents: number | null;
  minimumAnnualCents: number | null;
  bands: { lowerQty: number; upperQty: number | null; unitCents: number }[];
}

export type BillingConfigKind =
  | "positiveInteger"
  | "nonNegativeInteger"
  | "ratio"
  | "optionalPositiveNumber"
  | "timeZone";

export interface BillingConfigEntry {
  key: string;
  value: number | string | null;
  isFinal: boolean;
  description: string;
  updatedAt: string;
  kind: BillingConfigKind;
}

export interface ReviewTask {
  id: string;
  billingAccountId: string;
  accountName: string;
  type: "plan_review" | "enterprise_threshold" | "abuse_flag";
  reason: string;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  notes: string | null;
  details: Record<string, unknown>;
  resolvedAt: string | null;
  createdAt: string;
}
