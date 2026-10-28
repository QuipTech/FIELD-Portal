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
  // The account's main live plan; null without one.
  plan: {
    planCode: string;
    term: string;
    status: string;
    cancelAt: string | null;
    committedQty: number | null;
  } | null;
  overdueInvoiceCount: number;
  firstOverdueNoticeAt: string | null;
  // A fair-use allowance reached 100% this month.
  usageFlagged: boolean;
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
  plan: row.plan_code
    ? {
        planCode: row.plan_code,
        term: row.plan_term as string,
        status: row.plan_status as string,
        cancelAt: row.plan_cancel_at,
        committedQty: row.plan_committed_qty,
      }
    : null,
  overdueInvoiceCount: Number(row.overdue_count ?? 0),
  firstOverdueNoticeAt: row.first_overdue_notice_at?.toISOString() ?? null,
  usageFlagged: row.usage_flagged === true,
});
