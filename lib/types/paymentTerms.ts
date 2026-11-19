// How an organisation pays: by card (default) or on a 30-day account
// approved by QuipTech. Amounts are AUD cents ex GST; days are YYYY-MM-DD.
export type PaymentType = "card" | "account";
export type AccountStatus = "none" | "pending" | "approved" | "rejected" | "on_hold";
export type DiscountType = "percent" | "fixed_cents";

export interface FreePeriod {
  freeUntil: string;
  freePercent: number;
  reason: string | null;
  setAt: string | null;
  // Still discounting this month or later.
  active: boolean;
}

export interface AccountTerms {
  billingAccountId: string;
  timezone: string;
  paymentType: PaymentType;
  accountStatus: AccountStatus;
  // Invoices go out with account terms (bank transfer) only when true.
  usesAccountTerms: boolean;
  termsDays: number;
  creditLimitCents: number | null;
  poRequired: boolean;
  defaultPoNumber: string | null;
  application: {
    legalName: string | null;
    abn: string | null;
    accountsEmail: string | null;
    accountsPhone: string | null;
    notes: string | null;
    appliedAt: string | null;
    approvedAt: string | null;
    approvalNotes: string | null;
    rejectedAt: string | null;
    rejectedReason: string | null;
  };
  freePeriod: FreePeriod | null;
}

export interface PromoRedemption {
  id: string;
  promoCodeId: string;
  code: string;
  description: string;
  // e.g. "20% off machine charges for 3 months"
  summary: string;
  discountType: DiscountType;
  // Percent (1–100) or AUD cents off each month.
  discountValue: number;
  billingAccountId: string;
  accountName: string;
  redeemedAt: string;
  startsMonth: string;
  endsMonth: string | null;
}

// GET /organisation/billing/payment-terms
export interface OrganisationPaymentTerms extends AccountTerms {
  promo: PromoRedemption | null;
  // The monthly invoice still in review, which can take a PO number.
  draftInvoice: { id: string; periodStart: string; reviewUntil: string | null; poNumber: string | null } | null;
}

export interface AccountApplicationInput {
  legalName: string;
  abn: string;
  accountsEmail: string;
  accountsPhone: string;
  poRequired: boolean;
  notes: string | null;
}

// POST /organisation/billing/promo-code/validate
export interface PromoPreview {
  code: string;
  description: string;
  summary: string;
  discountType: DiscountType;
  discountValue: number;
  startsMonth: string;
  endsMonth: string | null;
}

// What a promo takes off one month's machine charges: never more than the
// charge itself.
export const promoDiscountCents = (
  promo: Pick<PromoPreview, "discountType" | "discountValue">,
  chargeCents: number,
): number =>
  Math.min(
    chargeCents,
    promo.discountType === "percent" ? Math.round((chargeCents * promo.discountValue) / 100) : promo.discountValue,
  );

export const PROMO_ERROR_CODES = [
  "invalid",
  "expired",
  "fully_used",
  "new_customers_only",
  "already_used",
  "promo_already_active",
] as const;

// ── Platform administrator ─────────────────────────────────────────────

export interface AccountApplication extends AccountTerms {
  accountName: string;
  billingEmail: string;
  organisationNames: string | null;
}

export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  durationMonths: number | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  redemptionsCount: number;
  newCustomersOnly: boolean;
  active: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCodeTerms {
  description: string;
  discountType: DiscountType;
  discountValue: number;
  durationMonths: number | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  newCustomersOnly: boolean;
}

export interface OverdueInvoice {
  invoiceId: string;
  billingAccountId: string;
  accountName: string;
  paymentType: PaymentType;
  invoiceKind: string;
  periodStart: string | null;
  dueOn: string;
  daysOverdue: number;
  outstandingCents: number;
  hostedInvoiceUrl: string | null;
  lastReminderOffset: number | null;
  suspended: boolean;
  creditLimitCents: number | null;
  accountUnpaidCents: number;
  overCreditLimit: boolean;
}

export type PaymentMethod = "bank_transfer" | "cheque" | "cash" | "other";
