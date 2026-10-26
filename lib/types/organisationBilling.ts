// GET /organisation/billing (billing.manage). Amounts are AUD cents ex GST.
export interface OrganisationPlan {
  id: string;
  planCode: string;
  planName: string;
  term: "monthly" | "annual";
  status: "active" | "cancelling" | "cancelled";
  committedQty: number | null;
  annualMonthsCharged: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  exportUntil: string | null;
  deleteAfter: string | null;
  nextTerm: "monthly" | "annual" | null;
  nextCommittedQty: number | null;
  priceBookVersion: number;
  unitCents: number | null;
  bands: { bandNo: number; lowerQty: number; upperQty: number | null; unitCents: number }[];
}

export type AllowanceMetric = "ai_turns" | "storage_bytes" | "ingest_pages";

export interface OrganisationBillingSummary {
  account: {
    id: string;
    name: string;
    billingEmail: string;
    timezone: string;
    suspendedAt: string | null;
    hasStripeCustomer: boolean;
  };
  plan: OrganisationPlan | null;
  thisMonth: {
    periodStart: string;
    invoicedOn: string;
    activeToday: number;
    peakSoFar: number;
    rateCents?: number | null;
    estimateCents?: number;
  };
  overdue: {
    count: number;
    amountCents: number;
    firstNoticeAt: string | null;
    suspensionFrom: string | null;
  };
  allowance: {
    metric: AllowanceMetric;
    allowance: number;
    used: number;
    thresholdState: "ok" | "notified" | "flagged";
  }[];
}

export interface AnnualQuote {
  committedQty: number;
  monthlyPriceCents: number;
  monthsCharged: number;
  upFrontCents: number;
  priceBookId: string;
  priceBookVersion: number;
}

// GET /organisation/billing/invoices
export interface OrganisationInvoice {
  id: string;
  status: string;
  currency: string;
  totalCents: number | null;
  gstCents: number | null;
  amountPaidCents: number;
  hostedInvoiceUrl: string | null;
  hasPdf: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}
