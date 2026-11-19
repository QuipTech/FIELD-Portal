import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';

type Reader = Pick<ServiceDatabaseService, 'query'>;

export type PaymentType = 'card' | 'account';
export type AccountStatus =
  'none' | 'pending' | 'approved' | 'rejected' | 'on_hold';

// How a billing account pays (card or 30-day account), its application and
// its free period. bigint arrives as a string; dates as YYYY-MM-DD.
export interface AccountTermsRow {
  id: string;
  name: string;
  abn: string | null;
  billing_email: string;
  timezone: string;
  payment_type: PaymentType;
  account_status: AccountStatus;
  terms_days: number;
  credit_limit_cents: string | null;
  po_required: boolean;
  default_po_number: string | null;
  account_legal_name: string | null;
  accounts_email: string | null;
  accounts_phone: string | null;
  application_notes: string | null;
  applied_at: Date | null;
  approved_at: Date | null;
  approval_notes: string | null;
  rejected_at: Date | null;
  rejected_reason: string | null;
  free_until: string | null;
  free_percent: number;
  free_reason: string | null;
  free_set_at: Date | null;
}

const TERMS_COLUMNS = `a.id, a.name, a.abn, a.billing_email, a.timezone, a.payment_type,
  a.account_status, a.terms_days, a.credit_limit_cents, a.po_required,
  a.default_po_number, a.account_legal_name, a.accounts_email, a.accounts_phone,
  a.application_notes, a.applied_at, a.approved_at, a.approval_notes,
  a.rejected_at, a.rejected_reason, a.free_until::text AS free_until,
  a.free_percent, a.free_reason, a.free_set_at`;

export const findAccountTerms = async (
  database: Reader,
  billingAccountId: string,
): Promise<AccountTermsRow | undefined> => {
  const result = await database.query<AccountTermsRow>(
    `SELECT ${TERMS_COLUMNS} FROM billing.billing_accounts a
     WHERE a.id = $1 AND a.deleted_at IS NULL`,
    [billingAccountId],
  );
  return result.rows[0];
};

// The billing account of the caller's organisation.
export const findOrganisationAccountTerms = async (
  database: Reader,
  tenantId: string,
): Promise<AccountTermsRow | undefined> => {
  const result = await database.query<AccountTermsRow>(
    `SELECT ${TERMS_COLUMNS}
     FROM tenants t JOIN billing.billing_accounts a ON a.id = t.billing_account_id
     WHERE t.id = $1 AND t.deleted_at IS NULL AND a.deleted_at IS NULL`,
    [tenantId],
  );
  return result.rows[0];
};

// Locks the row for a read-check-write in one transaction.
export const lockAccountTerms = async (
  client: PoolClient,
  billingAccountId: string,
): Promise<AccountTermsRow | undefined> => {
  const result = await client.query<AccountTermsRow>(
    `SELECT ${TERMS_COLUMNS} FROM billing.billing_accounts a
     WHERE a.id = $1 AND a.deleted_at IS NULL FOR UPDATE`,
    [billingAccountId],
  );
  return result.rows[0];
};

// Columns a change may set. Only the keys given are written; undefined
// means "leave as is" and null clears.
export interface AccountTermsChange {
  abn?: string | null;
  payment_type?: PaymentType;
  account_status?: AccountStatus;
  terms_days?: number;
  credit_limit_cents?: number | null;
  po_required?: boolean;
  default_po_number?: string | null;
  account_legal_name?: string | null;
  accounts_email?: string | null;
  accounts_phone?: string | null;
  application_notes?: string | null;
  applied_at?: 'now' | null;
  applied_by?: string | null;
  approved_at?: 'now' | null;
  approved_by?: string | null;
  approval_notes?: string | null;
  rejected_at?: 'now' | null;
  rejected_by?: string | null;
  rejected_reason?: string | null;
  free_until?: string | null;
  free_percent?: number;
  free_reason?: string | null;
  free_set_by?: string | null;
  free_set_at?: 'now' | null;
  credit_limit_warned_at?: null;
}

const CHANGEABLE_COLUMNS: (keyof AccountTermsChange)[] = [
  'abn',
  'payment_type',
  'account_status',
  'terms_days',
  'credit_limit_cents',
  'po_required',
  'default_po_number',
  'account_legal_name',
  'accounts_email',
  'accounts_phone',
  'application_notes',
  'applied_at',
  'applied_by',
  'approved_at',
  'approved_by',
  'approval_notes',
  'rejected_at',
  'rejected_by',
  'rejected_reason',
  'free_until',
  'free_percent',
  'free_reason',
  'free_set_by',
  'free_set_at',
  'credit_limit_warned_at',
];

export const updateAccountTerms = async (
  client: PoolClient,
  billingAccountId: string,
  change: AccountTermsChange,
): Promise<void> => {
  const sets: string[] = [];
  const values: unknown[] = [billingAccountId];
  for (const column of CHANGEABLE_COLUMNS) {
    const value = change[column];
    if (value === undefined) continue;
    if (value === 'now') {
      sets.push(`${column} = now()`);
      continue;
    }
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) return;
  await client.query(
    `UPDATE billing.billing_accounts SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    values,
  );
};

export interface ApplicationListRow extends AccountTermsRow {
  organisation_names: string | null;
}

// Accounts that have applied for 30-day terms: pending first, then on
// hold, then decided; oldest application first within each.
export const listApplications = async (
  database: Reader,
  status: AccountStatus | null,
): Promise<ApplicationListRow[]> => {
  const result = await database.query<ApplicationListRow>(
    `SELECT ${TERMS_COLUMNS},
            (SELECT string_agg(t.name, ', ' ORDER BY t.name) FROM tenants t
             WHERE t.billing_account_id = a.id AND t.deleted_at IS NULL) AS organisation_names
     FROM billing.billing_accounts a
     WHERE a.deleted_at IS NULL AND a.account_status <> 'none'
       AND ($1::varchar IS NULL OR a.account_status = $1)
     ORDER BY array_position(ARRAY['pending','on_hold','approved','rejected']::varchar[], a.account_status),
              a.applied_at NULLS LAST, a.name`,
    [status],
  );
  return result.rows;
};

// The account's monthly draft still in review, for a PO number to be added.
export const findDraftMonthlyInvoice = async (
  database: Reader,
  billingAccountId: string,
): Promise<
  | {
      id: string;
      period_start: string;
      review_until: Date | null;
      po_number: string | null;
    }
  | undefined
> => {
  const result = await database.query<{
    id: string;
    period_start: string;
    review_until: Date | null;
    po_number: string | null;
  }>(
    `SELECT id, period_start::text, review_until, po_number FROM billing.invoices
     WHERE billing_account_id = $1 AND kind = 'monthly' AND status = 'draft'
     ORDER BY period_start DESC LIMIT 1`,
    [billingAccountId],
  );
  return result.rows[0];
};

// Sets the PO number on one of the account's invoices while it's a draft.
// false when there's no such draft.
export const setDraftInvoicePoNumber = async (
  client: PoolClient,
  params: {
    invoiceId: string;
    billingAccountId: string;
    poNumber: string | null;
  },
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE billing.invoices SET po_number = $3, updated_at = now()
     WHERE id = $1 AND billing_account_id = $2 AND status = 'draft'`,
    [params.invoiceId, params.billingAccountId, params.poNumber],
  );
  return (result.rowCount ?? 0) > 0;
};
