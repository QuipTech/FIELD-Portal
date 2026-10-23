export interface BillingAccountRow {
  id: string;
  name: string;
  abn: string | null;
  billing_email: string;
  timezone: string;
  currency: string;
  stripe_customer_id: string | null;
  partner_id: string | null;
  billing_contact_name: string | null;
  suspended_at: Date | null;
  suspension_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

// One organisation, with its billing account's columns (NULL when it has
// none) prefixed account_.
export interface OrganisationBillingRow {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  account_id: string | null;
  account_name: string | null;
  account_abn: string | null;
  account_billing_email: string | null;
  account_timezone: string | null;
  account_currency: string | null;
  account_stripe_customer_id: string | null;
  account_partner_id: string | null;
  account_billing_contact_name: string | null;
  account_suspended_at: Date | null;
  account_suspension_reason: string | null;
  account_created_at: Date | null;
  account_updated_at: Date | null;
}
