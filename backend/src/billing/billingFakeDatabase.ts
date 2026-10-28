import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../database/serviceDatabase.service';
import { InvoiceLineRow, InvoiceRow } from './invoices/types/invoiceRows';

// An in-memory stand-in for the service-role pool in the billing specs. It
// answers the billing repositories' statements by recognising their SQL
// and mirrors what the real statements do (unique event ids, forward-only
// status), so the specs exercise the real repository code.

type QueryResult = { rows: unknown[]; rowCount: number };

export interface FakeBillingState {
  invoices: InvoiceRow[];
  lines: InvoiceLineRow[];
  webhookEventIds: Set<string>;
}

export const buildInvoiceRow = (
  overrides: Partial<InvoiceRow> = {},
): InvoiceRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  billing_account_id: '22222222-2222-4222-8222-222222222222',
  billing_account_name: 'Acme Mining',
  status: 'draft',
  currency: 'AUD',
  stripe_invoice_id: null,
  total_ex_gst_cents: '15000',
  gst_cents: null,
  total_cents: null,
  amount_paid_cents: '0',
  amount_refunded_cents: '0',
  hosted_invoice_url: null,
  period_start: null,
  period_end: null,
  review_until: null,
  held_at: null,
  hold_reason: null,
  created_at: new Date('2026-10-19T00:00:00Z'),
  updated_at: new Date('2026-10-19T00:00:00Z'),
  ...overrides,
});

export const buildLineRow = (
  position: number,
  invoiceId: string,
): InvoiceLineRow => ({
  id: `00000000-0000-4000-8000-00000000000${position}`,
  invoice_id: invoiceId,
  position,
  line_type: 'test',
  description: `Line ${position}`,
  quantity: 1,
  unit_cents: '5000',
  amount_cents: '5000',
  stripe_invoice_item_id: null,
  calc_snapshot: null,
  created_at: new Date('2026-10-19T00:00:00Z'),
  updated_at: new Date('2026-10-19T00:00:00Z'),
});

const updated = (count: number): QueryResult => ({ rows: [], rowCount: count });

const answer = (
  state: FakeBillingState,
  sql: string,
  params: unknown[],
): QueryResult => {
  if (sql.includes('INSERT INTO billing.stripe_webhook_events')) {
    const eventId = params[0] as string;
    if (state.webhookEventIds.has(eventId)) return updated(0);
    state.webhookEventIds.add(eventId);
    return { rows: [{ id: eventId }], rowCount: 1 };
  }
  if (sql.includes('FROM billing.invoice_lines')) {
    const rows = state.lines.filter((line) => line.invoice_id === params[0]);
    return { rows, rowCount: rows.length };
  }
  if (sql.includes('UPDATE billing.invoice_lines SET stripe_invoice_item_id')) {
    const line = state.lines.find((row) => row.id === params[0]);
    if (line) line.stripe_invoice_item_id = params[1] as string;
    return updated(line ? 1 : 0);
  }
  if (sql.includes("SET status = 'final'")) {
    const invoice = state.invoices.find((row) => row.id === params[0]);
    if (invoice?.status === 'draft') invoice.status = 'final';
    return updated(invoice ? 1 : 0);
  }
  if (sql.includes('SET stripe_invoice_id = $2')) {
    const invoice = state.invoices.find((row) => row.id === params[0]);
    if (invoice) invoice.stripe_invoice_id = params[1] as string;
    return updated(invoice ? 1 : 0);
  }
  if (sql.includes("THEN 'synced'")) {
    const invoice = state.invoices.find((row) => row.id === params[0]);
    if (!invoice) return updated(0);
    Object.assign(invoice, {
      total_ex_gst_cents: String(params[1]),
      gst_cents: String(params[2]),
      total_cents: String(params[3]),
      hosted_invoice_url: params[4] ?? invoice.hosted_invoice_url,
    });
    if ((params[5] as string[]).includes(invoice.status))
      invoice.status = 'synced';
    return updated(1);
  }
  if (sql.includes('stripe_invoice_id = COALESCE(stripe_invoice_id, $1)')) {
    const invoice = state.invoices.find(
      (row) =>
        row.stripe_invoice_id === params[0] ||
        (row.stripe_invoice_id === null && row.id === params[1]),
    );
    if (!invoice) return updated(0);
    invoice.stripe_invoice_id ??= params[0] as string;
    if ((params[2] as string[]).includes(invoice.status))
      invoice.status = params[3] as InvoiceRow['status'];
    Object.assign(invoice, {
      total_ex_gst_cents: String(params[4]),
      gst_cents: String(params[5]),
      total_cents: String(params[6]),
      amount_paid_cents: String(
        Math.max(Number(invoice.amount_paid_cents), Number(params[7])),
      ),
    });
    return updated(1);
  }
  if (sql.includes('SET amount_refunded_cents')) {
    const invoice = state.invoices.find(
      (row) => row.stripe_invoice_id === params[0],
    );
    if (invoice) invoice.amount_refunded_cents = String(params[1]);
    return updated(invoice ? 1 : 0);
  }
  throw new Error(`billingFakeDatabase doesn't recognise: ${sql}`);
};

export const createFakeBillingDatabase = (state: FakeBillingState) => {
  const client = {
    query: async (sql: string, params: unknown[] = []) =>
      answer(state, sql, params),
  } as unknown as PoolClient;
  const serviceDatabase = {
    query: client.query,
    transaction: async <T>(work: (pool: PoolClient) => Promise<T>) =>
      work(client),
  } as unknown as ServiceDatabaseService;
  return { serviceDatabase };
};
