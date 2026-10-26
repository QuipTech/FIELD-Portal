import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export interface CreditNoteRow {
  id: string;
  invoice_id: string;
  billing_account_id: string;
  amount_cents: string;
  reason: string;
  status: 'pending' | 'issued';
  stripe_credit_note_id: string | null;
  created_at: Date;
}

const COLUMNS = `id, invoice_id, billing_account_id, amount_cents, reason, status,
  stripe_credit_note_id, created_at`;

export const insertCreditNote = async (
  client: PoolClient,
  params: {
    invoiceId: string;
    billingAccountId: string;
    amountCents: number;
    reason: string;
    createdBy: string;
  },
): Promise<CreditNoteRow> => {
  const result = await client.query<CreditNoteRow>(
    `INSERT INTO billing.credit_notes
       (invoice_id, billing_account_id, amount_cents, reason, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
    [
      params.invoiceId,
      params.billingAccountId,
      params.amountCents,
      params.reason,
      params.createdBy,
    ],
  );
  return result.rows[0];
};

// Issued on Stripe: the note and the invoice's credited total, together.
export const markCreditNoteIssued = async (
  client: PoolClient,
  creditNoteId: string,
  stripeCreditNoteId: string,
): Promise<void> => {
  const issued = await client.query<{
    invoice_id: string;
    amount_cents: string;
  }>(
    `UPDATE billing.credit_notes
     SET status = 'issued', stripe_credit_note_id = $2, updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING invoice_id, amount_cents`,
    [creditNoteId, stripeCreditNoteId],
  );
  if (!issued.rows[0]) return;
  await client.query(
    `UPDATE billing.invoices
     SET amount_credited_cents = amount_credited_cents + $2, updated_at = now()
     WHERE id = $1`,
    [issued.rows[0].invoice_id, issued.rows[0].amount_cents],
  );
};

export const findCreditNote = async (
  database: Reader,
  creditNoteId: string,
): Promise<CreditNoteRow | undefined> => {
  const result = await database.query<CreditNoteRow>(
    `SELECT ${COLUMNS} FROM billing.credit_notes WHERE id = $1 AND deleted_at IS NULL`,
    [creditNoteId],
  );
  return result.rows[0];
};

export const listCreditNotes = async (
  database: Reader,
  invoiceId: string,
): Promise<CreditNoteRow[]> => {
  const result = await database.query<CreditNoteRow>(
    `SELECT ${COLUMNS} FROM billing.credit_notes
     WHERE invoice_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
    [invoiceId],
  );
  return result.rows;
};

// What can still be credited: the GST-inclusive total less notes already
// raised (pending ones included, so two admins can't over-credit).
export const findCreditable = async (
  client: PoolClient,
  invoiceId: string,
): Promise<
  | {
      billing_account_id: string;
      status: string;
      stripe_invoice_id: string | null;
      remaining_cents: string;
    }
  | undefined
> => {
  const result = await client.query(
    `SELECT i.billing_account_id, i.status, i.stripe_invoice_id,
            coalesce(i.total_cents, 0) - coalesce((
              SELECT sum(n.amount_cents) FROM billing.credit_notes n
              WHERE n.invoice_id = i.id AND n.deleted_at IS NULL), 0) AS remaining_cents
     FROM billing.invoices i WHERE i.id = $1 FOR UPDATE OF i`,
    [invoiceId],
  );
  return result.rows[0];
};
