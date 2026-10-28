import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import { AuthenticatedUser } from '../../auth/types/authenticatedUser';
import { PersonalPeriodRow } from './personalSubscriptionTypes';

type BillingReader = Pick<ServiceDatabaseService, 'query'>;

const PERSONAL_PERIOD_QUERY = `SELECT p.id, p.invoice_id, p.billing_account_id, p.price_book_id,
       p.period_start::text, p.period_end::text, l.unit_cents, i.status,
       i.total_cents, i.gst_cents, i.amount_paid_cents, i.amount_refunded_cents,
       i.hosted_invoice_url
     FROM billing.personal_periods p
     JOIN billing.invoices i ON i.id = p.invoice_id
     JOIN billing.invoice_lines l ON l.invoice_id = i.id AND l.position = 1
     WHERE p.user_id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`;

// The period that decides this month's status: replaced ones are left out.
export const findPersonalPeriods = async (
  client: BillingReader,
  actor: AuthenticatedUser,
) => {
  const result = await client.query<PersonalPeriodRow>(
    `${PERSONAL_PERIOD_QUERY} AND p.replaced_at IS NULL
     ORDER BY p.period_start DESC LIMIT 120`,
    [actor.userId, actor.tenantId],
  );
  return result.rows;
};

// Every invoice the user was sent, including refunded or void ones that a
// fresh invoice replaced.
export const findPersonalInvoiceHistory = async (
  client: BillingReader,
  actor: AuthenticatedUser,
) => {
  const result = await client.query<PersonalPeriodRow>(
    `${PERSONAL_PERIOD_QUERY}
     ORDER BY p.period_start DESC, p.created_at DESC LIMIT 120`,
    [actor.userId, actor.tenantId],
  );
  return result.rows;
};

export const markPersonalPeriodReplaced = async (
  client: BillingReader,
  periodId: string,
) => {
  await client.query(
    `UPDATE billing.personal_periods SET replaced_at = now(), updated_at = now()
     WHERE id = $1 AND replaced_at IS NULL`,
    [periodId],
  );
};

// A TECH seat on the user's own organisation account covers them for the
// day, so the organisation and the user never both pay for it.
export const hasOrganisationTechSeat = async (
  client: BillingReader,
  userId: string,
  day: string,
) => {
  const result = await client.query<{ covered: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM billing.seats s
       JOIN billing.subscriptions sub ON sub.id = s.subscription_id
       WHERE s.user_id = $1 AND s.deleted_at IS NULL AND sub.deleted_at IS NULL
         AND sub.plan_code = 'TECH' AND sub.status IN ('active', 'cancelling')
         AND s.started_on <= $2::date
         AND (s.billing_end IS NULL OR $2::date < s.billing_end)
         AND billing.user_belongs_to_account($1, s.billing_account_id)
     ) AS covered`,
    [userId, day],
  );
  return result.rows[0]?.covered === true;
};

export const findPersonalAccount = async (
  client: BillingReader,
  actor: AuthenticatedUser,
) => {
  const result = await client.query<{
    billing_account_id: string;
    timezone: string;
  }>(
    `SELECT p.billing_account_id, a.timezone FROM billing.personal_accounts p
     JOIN billing.billing_accounts a ON a.id = p.billing_account_id
     WHERE p.user_id = $1 AND p.tenant_id = $2
       AND p.deleted_at IS NULL AND a.deleted_at IS NULL`,
    [actor.userId, actor.tenantId],
  );
  return result.rows[0];
};
