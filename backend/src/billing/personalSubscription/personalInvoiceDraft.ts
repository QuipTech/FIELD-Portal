import { PoolClient } from 'pg';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { recordBillingAudit } from '../billingAudit/billingAudit';
import {
  findPersonalAccount,
  markPersonalPeriodReplaced,
} from './personalSubscription.repository';
import {
  PersonalBillingStatus,
  PersonalPeriodRow,
} from './personalSubscriptionTypes';

// Writes behind a personal payment, all inside the caller's locked
// transaction and each audited with it.

export const ensurePersonalAccount = async (
  client: PoolClient,
  actor: AuthenticatedUser,
  timezone: string,
): Promise<string> => {
  const existing = await findPersonalAccount(client, actor);
  if (existing) return existing.billing_account_id;
  const result = await client.query<{ id: string }>(
    `INSERT INTO billing.billing_accounts (name, billing_email, timezone)
     VALUES ($1, $1, $2) RETURNING id`,
    [actor.email, timezone],
  );
  const accountId = result.rows[0].id;
  await client.query(
    `INSERT INTO billing.personal_accounts (tenant_id, user_id, billing_account_id)
     VALUES ($1, $2, $3)`,
    [actor.tenantId, actor.userId, accountId],
  );
  await recordBillingAudit(client, actor, {
    action: 'create',
    entityType: 'billing_account',
    entityId: accountId,
    billingAccountId: accountId,
    from: null,
    to: { userId: actor.userId, timezone },
    reason: 'personal TECH account',
  });
  return accountId;
};

export const replacePersonalPeriod = async (
  client: PoolClient,
  actor: AuthenticatedUser,
  period: PersonalPeriodRow,
): Promise<void> => {
  await markPersonalPeriodReplaced(client, period.id);
  await recordBillingAudit(client, actor, {
    action: 'update',
    entityType: 'billing_invoice',
    entityId: period.invoice_id,
    billingAccountId: period.billing_account_id,
    from: {
      status: period.status,
      amountRefundedCents: Number(period.amount_refunded_cents),
    },
    to: { replaced: true },
    reason: 'personal TECH invoice refunded or void; new invoice for the month',
  });
};

interface PersonalInvoiceDraft {
  accountId: string;
  priceBookId: string;
  unitCents: number;
  status: PersonalBillingStatus;
}

export const createPersonalInvoiceDraft = async (
  client: PoolClient,
  actor: AuthenticatedUser,
  { accountId, priceBookId, unitCents, status }: PersonalInvoiceDraft,
): Promise<string> => {
  const invoice = await client.query<{ id: string }>(
    `INSERT INTO billing.invoices (billing_account_id, currency, total_ex_gst_cents, kind)
     VALUES ($1, 'AUD', $2, 'personal') RETURNING id`,
    [accountId, unitCents],
  );
  const invoiceId = invoice.rows[0].id;
  await client.query(
    `INSERT INTO billing.invoice_lines
     (invoice_id, position, line_type, description, quantity, unit_cents, amount_cents)
     VALUES ($1, 1, 'TECH', $2, 1, $3, $3)`,
    [
      invoiceId,
      `FIELD Technician — ${status.periodStart} to ${status.periodEnd} (end exclusive)`,
      unitCents,
    ],
  );
  await client.query(
    `INSERT INTO billing.personal_periods
     (tenant_id, user_id, billing_account_id, price_book_id, period_start, period_end, invoice_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      actor.tenantId,
      actor.userId,
      accountId,
      priceBookId,
      status.periodStart,
      status.periodEnd,
      invoiceId,
    ],
  );
  await recordBillingAudit(client, actor, {
    action: 'create',
    entityType: 'billing_invoice',
    entityId: invoiceId,
    billingAccountId: accountId,
    from: null,
    to: {
      status: 'draft',
      amountCents: unitCents,
      priceBookId,
      periodStart: status.periodStart,
      periodEnd: status.periodEnd,
    },
    reason: 'personal TECH monthly payment',
  });
  return invoiceId;
};
