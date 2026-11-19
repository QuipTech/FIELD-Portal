import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { CalculatedLine } from '../monthlyRun/monthlyRunTypes';
import {
  StatementLine,
  StatementStatus,
  StatementTotals,
} from './statementRules';

type Reader = Pick<ServiceDatabaseService, 'query'>;

// bigint arrives as a string; dates as YYYY-MM-DD.
export interface StatementRow {
  id: string;
  billing_account_id: string;
  period_start: string;
  period_end: string;
  status: StatementStatus;
  reference: string;
  po_number: string | null;
  subtotal_ex_gst_cents: string;
  gst_cents: string;
  total_inc_gst_cents: string;
  run_at: Date | null;
  terms_days: number | null;
  zoho_invoice_number: string | null;
  zoho_invoice_date: string | null;
  due_on: string | null;
  paid_on: string | null;
  paid_reference: string | null;
}

const STATEMENT_COLUMNS = `s.id, s.billing_account_id, s.period_start::text, s.period_end::text,
  s.status, s.reference, s.po_number, s.subtotal_ex_gst_cents, s.gst_cents,
  s.total_inc_gst_cents, s.run_at, s.terms_days, s.zoho_invoice_number,
  s.zoho_invoice_date::text, s.due_on::text, s.paid_on::text, s.paid_reference`;

export const isMonthLocked = async (
  database: Reader,
  periodStart: string,
): Promise<boolean> => {
  const result = await database.query<{ locked: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM billing.statement_months
       WHERE period_start = $1::date) AS locked`,
    [periodStart],
  );
  return result.rows[0]?.locked === true;
};

export const findMonthLock = async (
  database: Reader,
  periodStart: string,
): Promise<{ locked_at: Date } | undefined> => {
  const result = await database.query<{ locked_at: Date }>(
    `SELECT locked_at FROM billing.statement_months WHERE period_start = $1::date`,
    [periodStart],
  );
  return result.rows[0];
};

export const findStatement = async (
  database: Reader,
  statementId: string,
): Promise<StatementRow | undefined> => {
  const result = await database.query<StatementRow>(
    `SELECT ${STATEMENT_COLUMNS} FROM billing.statements s WHERE s.id = $1`,
    [statementId],
  );
  return result.rows[0];
};

// Locked for a read-check-write in one transaction.
export const lockStatement = async (
  client: PoolClient,
  statementId: string,
): Promise<StatementRow | undefined> => {
  const result = await client.query<StatementRow>(
    `SELECT ${STATEMENT_COLUMNS} FROM billing.statements s WHERE s.id = $1 FOR UPDATE`,
    [statementId],
  );
  return result.rows[0];
};

// The account's live statement for the month, locked.
export const lockStatementForMonth = async (
  client: PoolClient,
  billingAccountId: string,
  periodStart: string,
): Promise<StatementRow | undefined> => {
  const result = await client.query<StatementRow>(
    `SELECT ${STATEMENT_COLUMNS} FROM billing.statements s
     WHERE s.billing_account_id = $1 AND s.period_start = $2::date
       AND s.status <> 'void'
     FOR UPDATE`,
    [billingAccountId, periodStart],
  );
  return result.rows[0];
};

// A new draft for the month, numbered FLD-YYYY-MM-NNNN in the order they
// were made (one at a time per month, so numbers never collide).
export const insertStatement = async (
  client: PoolClient,
  params: {
    billingAccountId: string;
    periodStart: string;
    periodEnd: string;
    poNumber: string | null;
    termsDays: number;
    formatReference: (sequence: number) => string;
  },
): Promise<StatementRow> => {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `statement-reference:${params.periodStart}`,
  ]);
  const count = await client.query<{ count: string }>(
    `SELECT count(*) FROM billing.statements WHERE period_start = $1::date`,
    [params.periodStart],
  );
  const reference = params.formatReference(Number(count.rows[0].count) + 1);
  const result = await client.query<StatementRow>(
    `INSERT INTO billing.statements AS s
       (billing_account_id, period_start, period_end, reference, po_number, terms_days)
     VALUES ($1, $2::date, $3::date, $4, $5, $6)
     RETURNING ${STATEMENT_COLUMNS}`,
    [
      params.billingAccountId,
      params.periodStart,
      params.periodEnd,
      reference,
      params.poNumber,
      params.termsDays,
    ],
  );
  return result.rows[0];
};

export const appendStatementLines = async (
  client: PoolClient,
  statementId: string,
  lines: CalculatedLine[],
): Promise<void> => {
  const last = await client.query<{ position: number | null }>(
    `SELECT max(position) AS position FROM billing.statement_lines WHERE statement_id = $1`,
    [statementId],
  );
  let position = last.rows[0]?.position ?? 0;
  for (const line of lines) {
    position += 1;
    await client.query(
      `INSERT INTO billing.statement_lines
         (statement_id, position, line_type, description, quantity, unit_cents,
          amount_cents, calc_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        statementId,
        position,
        line.lineType,
        line.description,
        line.quantity,
        line.unitCents,
        line.amountCents,
        line.calcSnapshot,
      ],
    );
  }
};

interface LineRow {
  statement_id: string;
  line_type: string;
  description: string;
  quantity: number;
  unit_cents: string;
  amount_cents: string;
  calc_snapshot: StatementLine['calcSnapshot'];
}

export const listStatementLines = async (
  database: Reader,
  statementIds: string[],
): Promise<Map<string, StatementLine[]>> => {
  const lines = new Map<string, StatementLine[]>();
  if (statementIds.length === 0) return lines;
  const result = await database.query<LineRow>(
    `SELECT statement_id, line_type, description, quantity, unit_cents,
            amount_cents, calc_snapshot
     FROM billing.statement_lines WHERE statement_id = ANY($1::uuid[])
     ORDER BY statement_id, position`,
    [statementIds],
  );
  for (const row of result.rows) {
    const list = lines.get(row.statement_id) ?? [];
    list.push({
      lineType: row.line_type,
      description: row.description,
      quantity: row.quantity,
      unitCents: Number(row.unit_cents),
      amountCents: Number(row.amount_cents),
      calcSnapshot: row.calc_snapshot ?? {},
    });
    lines.set(row.statement_id, list);
  }
  return lines;
};

// True when a line with this snapshot key is already on any live statement
// (an annual term or onboarding is added once).
export const hasStatementLine = async (
  database: Reader,
  billingAccountId: string,
  lineType: string,
  snapshotKey: Record<string, string>,
): Promise<boolean> => {
  const result = await database.query<{ found: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM billing.statement_lines l
       JOIN billing.statements s ON s.id = l.statement_id AND s.status <> 'void'
       WHERE s.billing_account_id = $1 AND l.line_type = $2
         AND l.calc_snapshot @> $3::jsonb) AS found`,
    [billingAccountId, lineType, snapshotKey],
  );
  return result.rows[0]?.found === true;
};

export const saveStatementTotals = async (
  client: PoolClient,
  statementId: string,
  totals: StatementTotals,
  options: { markRun?: boolean } = {},
): Promise<void> => {
  await client.query(
    `UPDATE billing.statements SET subtotal_ex_gst_cents = $2, gst_cents = $3,
       total_inc_gst_cents = $4,
       run_at = CASE WHEN $5 THEN coalesce(run_at, now()) ELSE run_at END,
       updated_at = now()
     WHERE id = $1`,
    [
      statementId,
      totals.subtotalExGstCents,
      totals.gstCents,
      totals.totalIncGstCents,
      options.markRun === true,
    ],
  );
};

// The month's run has already written this account's statement.
export const hasRunStatement = async (
  database: Reader,
  billingAccountId: string,
  periodStart: string,
): Promise<boolean> => {
  const result = await database.query<{ found: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM billing.statements
       WHERE billing_account_id = $1 AND period_start = $2::date
         AND status <> 'void' AND run_at IS NOT NULL) AS found`,
    [billingAccountId, periodStart],
  );
  return result.rows[0]?.found === true;
};

export interface ReportRow extends StatementRow {
  account_name: string;
  legal_name: string | null;
  abn: string | null;
  accounts_email: string | null;
  billing_email: string;
  payment_type: string;
  account_terms_days: number;
  timezone: string;
}

export const listReportRows = async (
  database: Reader,
  filters: {
    periodStart: string;
    paymentType: string | null;
    status: StatementStatus | null;
  },
): Promise<ReportRow[]> => {
  const result = await database.query<ReportRow>(
    `SELECT ${STATEMENT_COLUMNS}, a.name AS account_name,
            a.account_legal_name AS legal_name, a.abn, a.accounts_email,
            a.billing_email, a.payment_type, a.terms_days AS account_terms_days,
            a.timezone
     FROM billing.statements s
     JOIN billing.billing_accounts a ON a.id = s.billing_account_id
     WHERE s.period_start = $1::date
       AND ($2::varchar IS NULL OR a.payment_type = $2)
       AND (CASE WHEN $3::varchar IS NULL THEN s.status <> 'void' ELSE s.status = $3 END)
     ORDER BY a.name, s.reference`,
    [filters.periodStart, filters.paymentType, filters.status],
  );
  return result.rows;
};

// Marks the month ready: every draft statement is locked, and later
// up-front charges go on the next month's statement.
export const lockMonth = async (
  client: PoolClient,
  periodStart: string,
  userId: string,
): Promise<{ lockedCount: number; alreadyLocked: boolean }> => {
  const inserted = await client.query(
    `INSERT INTO billing.statement_months (period_start, locked_by)
     VALUES ($1::date, $2) ON CONFLICT (period_start) DO NOTHING`,
    [periodStart, userId],
  );
  const updated = await client.query(
    `UPDATE billing.statements SET status = 'ready', ready_at = now(),
       ready_by = $2, updated_at = now()
     WHERE period_start = $1::date AND status = 'draft'`,
    [periodStart, userId],
  );
  return {
    lockedCount: updated.rowCount ?? 0,
    alreadyLocked: (inserted.rowCount ?? 0) === 0,
  };
};

export const setZohoInvoice = async (
  client: PoolClient,
  params: {
    statementId: string;
    invoiceNumber: string;
    invoiceDate: string;
    termsDays: number;
    dueOn: string;
    userId: string;
  },
): Promise<void> => {
  await client.query(
    `UPDATE billing.statements SET status = 'invoiced_external',
       zoho_invoice_number = $2, zoho_invoice_date = $3::date,
       terms_days = $4, due_on = $5::date,
       invoiced_at = now(), invoiced_by = $6, updated_at = now()
     WHERE id = $1`,
    [
      params.statementId,
      params.invoiceNumber,
      params.invoiceDate,
      params.termsDays,
      params.dueOn,
      params.userId,
    ],
  );
};

export const markStatementPaid = async (
  client: PoolClient,
  params: {
    statementId: string;
    paidOn: string;
    reference: string | null;
    userId: string;
  },
): Promise<void> => {
  await client.query(
    `UPDATE billing.statements SET status = 'paid', paid_on = $2::date,
       paid_reference = $3, paid_at = now(), paid_by = $4, updated_at = now()
     WHERE id = $1`,
    [params.statementId, params.paidOn, params.reference, params.userId],
  );
};

export const voidStatement = async (
  client: PoolClient,
  statementId: string,
  reason: string,
): Promise<void> => {
  await client.query(
    `UPDATE billing.statements SET status = 'void', void_reason = $2, updated_at = now()
     WHERE id = $1`,
    [statementId, reason],
  );
};

interface MachineRow {
  machine_id: string;
  plant_id: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string;
  deleted: boolean;
  activated_on: string;
  billing_end: string | null;
}

// Every activation interval of the account's machines that overlaps the
// month, with what the machine is (deleted machines included).
export const listStatementMachineIntervals = async (
  database: Reader,
  billingAccountId: string,
  periodStart: string,
  periodEnd: string,
): Promise<MachineRow[]> => {
  const result = await database.query<MachineRow>(
    `SELECT m.id AS machine_id, coalesce(m.fleet_number, m.asset_number) AS plant_id,
            mf.name AS manufacturer, mm.name AS model, m.serial_number,
            (m.deleted_at IS NOT NULL) AS deleted,
            a.activated_on::text, a.billing_end::text
     FROM billing.machine_activations a
     JOIN machines m ON m.id = a.machine_id
     LEFT JOIN machine_models mm ON mm.id = m.model_id
     LEFT JOIN machine_manufacturers mf ON mf.id = m.manufacturer_id
     WHERE a.billing_account_id = $1 AND a.deleted_at IS NULL
       AND a.activated_on < $3::date
       AND (a.billing_end IS NULL OR a.billing_end > $2::date)
     ORDER BY plant_id NULLS LAST, m.serial_number, a.activated_on`,
    [billingAccountId, periodStart, periodEnd],
  );
  return result.rows;
};

// An organisation's own statements, newest first (drafts are still being
// worked out, so they're left out).
export const listAccountStatements = async (
  database: Reader,
  billingAccountId: string,
): Promise<StatementRow[]> => {
  const result = await database.query<StatementRow>(
    `SELECT ${STATEMENT_COLUMNS} FROM billing.statements s
     WHERE s.billing_account_id = $1 AND s.status NOT IN ('draft', 'void')
     ORDER BY s.period_start DESC
     LIMIT 36`,
    [billingAccountId],
  );
  return result.rows;
};

export interface ReminderStatementRow extends StatementRow {
  account_name: string;
  billing_email: string;
  accounts_email: string | null;
  timezone: string;
  sent_offsets: number[];
}

// Invoiced, unpaid statements whose due date is close enough for a reminder.
export const listStatementsForReminders = async (
  database: Reader,
  leadDays: number,
): Promise<ReminderStatementRow[]> => {
  const result = await database.query<ReminderStatementRow>(
    `SELECT ${STATEMENT_COLUMNS}, a.name AS account_name, a.billing_email,
            a.accounts_email, a.timezone,
            coalesce((SELECT array_agg(r.offset_days) FROM billing.statement_reminders r
                      WHERE r.statement_id = s.id), '{}') AS sent_offsets
     FROM billing.statements s
     JOIN billing.billing_accounts a ON a.id = s.billing_account_id
     WHERE s.status = 'invoiced_external' AND s.due_on IS NOT NULL
       AND s.due_on <= (now() AT TIME ZONE a.timezone)::date + $1::int
       AND a.deleted_at IS NULL`,
    [leadDays],
  );
  return result.rows;
};

// true when this call recorded it (so only one container sends it).
export const recordStatementReminder = async (
  database: Reader,
  statementId: string,
  offsetDays: number,
): Promise<boolean> => {
  const result = await database.query(
    `INSERT INTO billing.statement_reminders (statement_id, offset_days)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [statementId, offsetDays],
  );
  return (result.rowCount ?? 0) > 0;
};

export interface OverdueStatementRow extends StatementRow {
  account_name: string;
  payment_type: string;
  days_overdue: number;
  last_reminder_offset: number | null;
  suspended_at: Date | null;
  credit_limit_cents: string | null;
}

// Invoiced in Zoho, unpaid and past the due date, most overdue first.
export const listOverdueStatements = async (
  database: Reader,
): Promise<OverdueStatementRow[]> => {
  const result = await database.query<OverdueStatementRow>(
    `SELECT ${STATEMENT_COLUMNS}, a.name AS account_name, a.payment_type,
            ((now() AT TIME ZONE a.timezone)::date - s.due_on) AS days_overdue,
            (SELECT max(r.offset_days) FROM billing.statement_reminders r
             WHERE r.statement_id = s.id) AS last_reminder_offset,
            a.suspended_at, a.credit_limit_cents
     FROM billing.statements s
     JOIN billing.billing_accounts a ON a.id = s.billing_account_id
     WHERE s.status = 'invoiced_external'
       AND s.due_on < (now() AT TIME ZONE a.timezone)::date
       AND a.deleted_at IS NULL
     ORDER BY s.due_on, a.name, s.id`,
  );
  return result.rows;
};
