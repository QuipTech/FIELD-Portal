import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { AdminInvoiceCategory, CATEGORY_SQL } from './adminInvoiceCategories';

type Reader = Pick<ServiceDatabaseService, 'query'>;

// bigint columns arrive from pg as strings.
export interface AdminInvoiceRow {
  id: string;
  category: AdminInvoiceCategory;
  status: string;
  // The user who pays a personal invoice; null for organisation invoices.
  payer_email: string | null;
  payer_name: string | null;
  organisation_name: string | null;
  billing_account_name: string;
  kind: 'personal' | 'organisation';
  period_start: string | null;
  total_ex_gst_cents: string;
  gst_cents: string | null;
  total_cents: string | null;
  amount_paid_cents: string;
  amount_refunded_cents: string;
  stripe_invoice_id: string | null;
  hosted_invoice_url: string | null;
  created_at: Date;
  updated_at: Date;
}

const FROM = `FROM billing.invoices i
  JOIN billing.billing_accounts a ON a.id = i.billing_account_id
  LEFT JOIN billing.personal_periods p ON p.invoice_id = i.id
  LEFT JOIN users u ON u.id = p.user_id
  LEFT JOIN tenants t ON t.id = p.tenant_id`;

// $1 category, $2 search text (payer email or name, organisation, account).
const WHERE = `WHERE ($1::varchar IS NULL OR ${CATEGORY_SQL} = $1)
  AND ($2::varchar IS NULL
    OR u.email ILIKE $2 OR (u.first_name || ' ' || u.last_name) ILIKE $2
    OR t.name ILIKE $2 OR a.name ILIKE $2)`;

export const listAdminInvoices = async (
  database: Reader,
  filters: {
    category?: AdminInvoiceCategory;
    search?: string;
    limit: number;
    offset: number;
  },
) => {
  const params = [
    filters.category ?? null,
    filters.search ? `%${filters.search.replace(/[\\%_]/g, '\\$&')}%` : null,
  ];
  const [page, count] = await Promise.all([
    database.query<AdminInvoiceRow>(
      `SELECT i.id, ${CATEGORY_SQL} AS category, i.status,
         u.email AS payer_email,
         NULLIF(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '') AS payer_name,
         t.name AS organisation_name, a.name AS billing_account_name,
         CASE WHEN p.id IS NULL THEN 'organisation' ELSE 'personal' END AS kind,
         coalesce(p.period_start, i.period_start)::text AS period_start,
         i.total_ex_gst_cents, i.gst_cents, i.total_cents, i.amount_paid_cents,
         i.amount_refunded_cents, i.stripe_invoice_id, i.hosted_invoice_url,
         i.created_at, i.updated_at
       ${FROM} ${WHERE}
       ORDER BY i.created_at DESC, i.id LIMIT $3 OFFSET $4`,
      [...params, filters.limit, filters.offset],
    ),
    database.query<{ total: string }>(
      `SELECT count(*) AS total ${FROM} ${WHERE}`,
      params,
    ),
  ]);
  return { rows: page.rows, total: Number(count.rows[0]?.total ?? 0) };
};

// Count and money per category across every invoice, for the summary tiles
// and filter chips. Totals include GST once Stripe has calculated it.
export const summariseAdminInvoices = async (database: Reader) => {
  const result = await database.query<{
    category: AdminInvoiceCategory;
    count: string;
    total_cents: string;
    paid_cents: string;
  }>(
    `SELECT ${CATEGORY_SQL} AS category, count(*) AS count,
       coalesce(sum(coalesce(i.total_cents, i.total_ex_gst_cents)), 0) AS total_cents,
       coalesce(sum(i.amount_paid_cents - i.amount_refunded_cents), 0) AS paid_cents
     FROM billing.invoices i GROUP BY 1`,
  );
  return result.rows;
};

// Invoices Stripe may have taken payment for without telling us: sent or
// failed ones, and personal ones whose Checkout may have completed.
export const findInvoicesToReconcile = async (
  database: Reader,
  limit: number,
) => {
  const result = await database.query<{ id: string }>(
    `SELECT i.id FROM billing.invoices i
     WHERE i.status IN ('synced', 'payment_failed')
        OR (i.status = 'draft' AND i.stripe_invoice_id IS NULL
            AND EXISTS (SELECT 1 FROM billing.personal_periods p WHERE p.invoice_id = i.id))
     ORDER BY i.created_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => row.id);
};
