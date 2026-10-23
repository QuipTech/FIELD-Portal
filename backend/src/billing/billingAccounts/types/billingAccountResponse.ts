import {
  BillingAccountRow,
  OrganisationBillingRow,
} from './billingAccountRows';

export interface BillingAccount {
  id: string;
  name: string;
  abn: string | null;
  billingEmail: string;
  timezone: string;
  currency: string;
  stripeCustomerId: string | null;
  partnerId: string | null;
  billingContactName: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganisationBilling {
  organisationId: string;
  organisationName: string;
  organisationStatus: string;
  billingAccount: BillingAccount | null;
}

export const toBillingAccount = (row: BillingAccountRow): BillingAccount => ({
  id: row.id,
  name: row.name,
  abn: row.abn,
  billingEmail: row.billing_email,
  timezone: row.timezone,
  currency: row.currency,
  stripeCustomerId: row.stripe_customer_id,
  partnerId: row.partner_id,
  billingContactName: row.billing_contact_name,
  suspendedAt: row.suspended_at?.toISOString() ?? null,
  suspensionReason: row.suspension_reason,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const toOrganisationBilling = (
  row: OrganisationBillingRow,
): OrganisationBilling => ({
  organisationId: row.tenant_id,
  organisationName: row.tenant_name,
  organisationStatus: row.tenant_status,
  billingAccount: row.account_id
    ? toBillingAccount({
        id: row.account_id,
        name: row.account_name as string,
        abn: row.account_abn,
        billing_email: row.account_billing_email as string,
        timezone: row.account_timezone as string,
        currency: row.account_currency as string,
        stripe_customer_id: row.account_stripe_customer_id,
        partner_id: row.account_partner_id,
        billing_contact_name: row.account_billing_contact_name,
        suspended_at: row.account_suspended_at,
        suspension_reason: row.account_suspension_reason,
        created_at: row.account_created_at as Date,
        updated_at: row.account_updated_at as Date,
      })
    : null,
});
