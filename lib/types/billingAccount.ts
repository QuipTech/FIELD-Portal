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
