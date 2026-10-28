import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

type BillingReader = Pick<ServiceDatabaseService, 'query'>;

export interface BillingAccountRef {
  billing_account_id: string;
  stripe_customer_id: string | null;
}

export interface CustomerInvoiceRow {
  id: string;
  status: string;
  currency: string;
  total_cents: string | null;
  gst_cents: string | null;
  amount_paid_cents: string;
  hosted_invoice_url: string | null;
  has_stripe_invoice: boolean;
  period_start: string | null;
  period_end: string | null;
  created_at: Date;
}

// Customers only see invoices Stripe has (synced or later): drafts and
// invoices still being pushed are FIELD's own work in progress.
const CUSTOMER_VISIBLE_STATUSES = ['synced', 'paid', 'payment_failed', 'void'];

// The organisation's billing account (tenants.billing_account_id).
export const findOrganisationAccount = async (
  reader: BillingReader,
  tenantId: string,
): Promise<BillingAccountRef | null> => {
  const result = await reader.query<BillingAccountRef>(
    `SELECT a.id AS billing_account_id, a.stripe_customer_id
     FROM tenants t JOIN billing.billing_accounts a ON a.id = t.billing_account_id
     WHERE t.id = $1`,
    [tenantId],
  );
  return result.rows[0] ?? null;
};

// The user's own personal TECH account (migration 0098).
export const findPersonalAccount = async (
  reader: BillingReader,
  params: { userId: string; tenantId: string },
): Promise<BillingAccountRef | null> => {
  const result = await reader.query<BillingAccountRef>(
    `SELECT a.id AS billing_account_id, a.stripe_customer_id
     FROM billing.personal_accounts p
     JOIN billing.billing_accounts a ON a.id = p.billing_account_id
     WHERE p.user_id = $1 AND p.tenant_id = $2`,
    [params.userId, params.tenantId],
  );
  return result.rows[0] ?? null;
};

export const listAccountInvoices = async (
  reader: BillingReader,
  billingAccountId: string,
): Promise<CustomerInvoiceRow[]> => {
  const result = await reader.query<CustomerInvoiceRow>(
    `SELECT id, status, currency, total_cents, gst_cents, amount_paid_cents,
            hosted_invoice_url, stripe_invoice_id IS NOT NULL AS has_stripe_invoice,
            period_start::text, period_end::text, created_at
     FROM billing.invoices
     WHERE billing_account_id = $1 AND status = ANY($2)
     ORDER BY created_at DESC LIMIT 120`,
    [billingAccountId, CUSTOMER_VISIBLE_STATUSES],
  );
  return result.rows;
};

// The Stripe id of one of the account's customer-visible invoices.
export const findAccountStripeInvoiceId = async (
  reader: BillingReader,
  params: { billingAccountId: string; invoiceId: string },
): Promise<string | null> => {
  const result = await reader.query<{ stripe_invoice_id: string | null }>(
    `SELECT stripe_invoice_id FROM billing.invoices
     WHERE id = $1 AND billing_account_id = $2 AND status = ANY($3)`,
    [params.invoiceId, params.billingAccountId, CUSTOMER_VISIBLE_STATUSES],
  );
  return result.rows[0]?.stripe_invoice_id ?? null;
};
