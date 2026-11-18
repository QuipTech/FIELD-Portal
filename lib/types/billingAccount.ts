// An organisation's billing account (Owner / platform admin screens).
// Machines can only be activated once their organisation has one.
export interface BillingAccount {
  id: string;
  name: string;
  abn: string | null;
  billingEmail: string;
  timezone: string;
  currency: string;
  // Null until Stripe is reachable; the first invoice creates it then.
  stripeCustomerId: string | null;
  suspendedAt: string | null;
  createdAt: string;
}

// GET /admin/billing/organisations
export interface OrganisationBilling {
  organisationId: string;
  organisationName: string;
  organisationStatus: string;
  billingAccount: BillingAccount | null;
  // The account's main live plan (ENTERPRISE, ASSET_PRO, INTERNAL or TECH).
  plan: {
    planCode: string;
    term: string;
    status: string;
    cancelAt: string | null;
    committedQty: number | null;
  } | null;
  overdueInvoiceCount: number;
  // The earliest unpaid due date that has passed; suspension is allowed
  // SUSPENSION_NOTICE_DAYS (14) after it.
  firstOverdueDueOn: string | null;
  // A fair-use allowance reached 100% this month.
  usageFlagged: boolean;
  // card or account (30-day terms), and where an application stands.
  paymentType: "card" | "account" | null;
  accountStatus: "none" | "pending" | "approved" | "rejected" | "on_hold" | null;
  freePeriod: { freeUntil: string; freePercent: number } | null;
}

// POST /admin/billing/accounts
export interface NewBillingAccount {
  organisationId: string;
  name: string;
  billingEmail: string;
  // 11 digits; omitted when unknown.
  abn?: string;
  // IANA zone; omitted for the platform default.
  timezone?: string;
}
