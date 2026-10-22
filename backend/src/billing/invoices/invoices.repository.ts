import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { InvoiceLineRow, InvoiceRow } from './types/invoiceRows';
import { InvoiceStatus } from './invoiceStatuses';

export interface DraftInvoiceLine {
  lineType: string;
  description: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
}

const INVOICE_SELECT = `SELECT i.id, i.billing_account_id, a.name AS billing_account_name,
    i.status, i.currency, i.stripe_invoice_id, i.total_ex_gst_cents, i.gst_cents,
    i.total_cents, i.amount_paid_cents, i.amount_refunded_cents,
    i.hosted_invoice_url, i.period_start::text, i.period_end::text, i.review_until,
    i.held_at, i.hold_reason, i.created_at, i.updated_at
  FROM billing.invoices i
  JOIN billing.billing_accounts a ON a.id = i.billing_account_id`;

// Audited, on the tenant role via SECURITY DEFINER (migration 0094).
// NULL when the billing account doesn't exist.
export const createDraftInvoice = async (
  client: PoolClient,
  billingAccountId: string,
  lines: DraftInvoiceLine[],
): Promise<string | null> => {
  const result = await client.query<{ id: string | null }>(
    `SELECT admin_create_draft_invoice($1, $2::jsonb) AS id`,
    [billingAccountId, JSON.stringify(lines)],
  );
  return result.rows[0]?.id ?? null;
};

export const findInvoice = async (
  serviceDatabase: ServiceDatabaseService,
  invoiceId: string,
): Promise<InvoiceRow | undefined> => {
  const result = await serviceDatabase.query<InvoiceRow>(
    `${INVOICE_SELECT} WHERE i.id = $1`,
    [invoiceId],
  );
  return result.rows[0];
};

export const listInvoiceLines = async (
  serviceDatabase: ServiceDatabaseService,
  invoiceId: string,
): Promise<InvoiceLineRow[]> => {
  const result = await serviceDatabase.query<InvoiceLineRow>(
    `SELECT id, invoice_id, position, line_type, description, quantity, unit_cents,
            amount_cents, stripe_invoice_item_id, calc_snapshot, created_at, updated_at
     FROM billing.invoice_lines WHERE invoice_id = $1 ORDER BY position`,
    [invoiceId],
  );
  return result.rows;
};

export const listInvoicesPage = async (
  serviceDatabase: ServiceDatabaseService,
  filters: {
    billingAccountId?: string;
    status?: InvoiceStatus;
    limit: number;
    offset: number;
  },
): Promise<{ rows: InvoiceRow[]; total: number }> => {
  const where = `WHERE ($1::uuid IS NULL OR i.billing_account_id = $1)
                   AND ($2::varchar IS NULL OR i.status = $2)`;
  const params = [filters.billingAccountId ?? null, filters.status ?? null];
  const [page, count] = await Promise.all([
    serviceDatabase.query<InvoiceRow>(
      `${INVOICE_SELECT} ${where} ORDER BY i.created_at DESC, i.id LIMIT $3 OFFSET $4`,
      [...params, filters.limit, filters.offset],
    ),
    serviceDatabase.query<{ total: string }>(
      `SELECT count(*) AS total FROM billing.invoices i ${where}`,
      params,
    ),
  ]);
  return { rows: page.rows, total: Number(count.rows[0]?.total ?? 0) };
};
