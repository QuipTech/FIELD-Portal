export type SubscriptionTerm = 'monthly' | 'annual';
export type SubscriptionStatus = 'active' | 'cancelling' | 'cancelled';

// bigint columns arrive as strings; date columns as local-midnight Dates.
export interface SubscriptionRow {
  id: string;
  billing_account_id: string;
  plan_code: string;
  price_book_id: string;
  term: SubscriptionTerm;
  committed_qty: number | null;
  annual_months_charged: number | null;
  contract_annual_cents: string | null;
  status: SubscriptionStatus;
  started_at: Date;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at: Date | null;
  export_until: Date | null;
  delete_after: Date | null;
  next_term: SubscriptionTerm | null;
  next_committed_qty: number | null;
}

export interface Subscription {
  id: string;
  billingAccountId: string;
  planCode: string;
  priceBookId: string;
  term: SubscriptionTerm;
  committedQty: number | null;
  annualMonthsCharged: number | null;
  contractAnnualCents: number | null;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  exportUntil: string | null;
  deleteAfter: string | null;
  // The customer's choice for the next term; null = same as now.
  nextTerm: SubscriptionTerm | null;
  nextCommittedQty: number | null;
}

// A term to write: the period, the pinned price book and, for annual
// terms, the commitment and months charged in effect when it was agreed.
export interface SubscriptionTermPlan {
  term: SubscriptionTerm;
  priceBookId: string;
  periodStart: string;
  periodEnd: string;
  committedQty: number | null;
  annualMonthsCharged: number | null;
}

export interface CancellationPlan {
  cancelAt: string;
  exportUntil: string;
  deleteAfter: string;
}
