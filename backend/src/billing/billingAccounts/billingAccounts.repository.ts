import { PoolClient } from 'pg';
import { ServiceDatabaseService } from '../../database/serviceDatabase.service';
import {
  BillingAccountRow,
  OrganisationBillingRow,
} from './types/billingAccountRows';

const ACCOUNT_COLUMNS = `id, name, abn, billing_email, timezone, currency,
  stripe_customer_id, partner_id, billing_contact_name, suspended_at,
  suspension_reason, created_at, updated_at`;

// Reads and Stripe-id updates run on the service role (billing.* is
// invisible to the tenant role); the audited create runs on the tenant
// role through a SECURITY DEFINER function (migration 0094).

export const listOrganisationsWithBilling = async (
  serviceDatabase: ServiceDatabaseService,
): Promise<OrganisationBillingRow[]> => {
  const result = await serviceDatabase.query<OrganisationBillingRow>(
    `SELECT t.id AS tenant_id, t.name AS tenant_name, t.status AS tenant_status,
            a.id AS account_id, a.name AS account_name, a.abn AS account_abn,
            a.billing_email AS account_billing_email, a.timezone AS account_timezone,
            a.currency AS account_currency, a.stripe_customer_id AS account_stripe_customer_id,
            a.partner_id AS account_partner_id,
            a.billing_contact_name AS account_billing_contact_name,
            a.suspended_at AS account_suspended_at,
            a.suspension_reason AS account_suspension_reason,
            a.created_at AS account_created_at, a.updated_at AS account_updated_at,
            plan.plan_code, plan.term AS plan_term, plan.status AS plan_status,
            plan.cancel_at::text AS plan_cancel_at, plan.committed_qty AS plan_committed_qty,
            (SELECT count(*) FROM billing.invoices i
             WHERE i.billing_account_id = a.id AND i.status IN ('synced', 'payment_failed')
               AND i.due_on < (now() AT TIME ZONE a.timezone)::date) AS overdue_count,
            (SELECT min(i.overdue_notice_1_at) FROM billing.invoices i
             WHERE i.billing_account_id = a.id AND i.status IN ('synced', 'payment_failed')) AS first_overdue_notice_at,
            EXISTS (SELECT 1 FROM billing.allowance_periods ap
                    WHERE ap.billing_account_id = a.id AND ap.threshold_state = 'flagged'
                      AND ap.closed_at IS NULL) AS usage_flagged
     FROM tenants t
     LEFT JOIN billing.billing_accounts a
       ON a.id = t.billing_account_id AND a.deleted_at IS NULL
     LEFT JOIN LATERAL (
       SELECT s.plan_code, s.term, s.status, s.cancel_at, s.committed_qty
       FROM billing.subscriptions s
       WHERE s.billing_account_id = a.id AND s.deleted_at IS NULL AND s.status <> 'cancelled'
       ORDER BY array_position(ARRAY['ENTERPRISE','ASSET_PRO','INTERNAL','TECH'], s.plan_code::text)
       LIMIT 1
     ) plan ON true
     WHERE t.deleted_at IS NULL
     ORDER BY t.name`,
  );
  return result.rows;
};

export const findBillingAccount = async (
  serviceDatabase: ServiceDatabaseService,
  billingAccountId: string,
): Promise<BillingAccountRow | undefined> => {
  const result = await serviceDatabase.query<BillingAccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM billing.billing_accounts
     WHERE id = $1 AND deleted_at IS NULL`,
    [billingAccountId],
  );
  return result.rows[0];
};

export const saveStripeCustomerId = async (
  serviceDatabase: ServiceDatabaseService,
  billingAccountId: string,
  stripeCustomerId: string,
): Promise<void> => {
  await serviceDatabase.query(
    `UPDATE billing.billing_accounts SET stripe_customer_id = $2 WHERE id = $1`,
    [billingAccountId, stripeCustomerId],
  );
};

// NULL when the organisation doesn't exist; a unique violation when it
// already has a billing account.
export const createBillingAccount = async (
  client: PoolClient,
  params: {
    organisationId: string;
    name: string;
    abn: string | null;
    billingEmail: string;
    timezone: string;
  },
): Promise<string | null> => {
  const result = await client.query<{ id: string | null }>(
    `SELECT admin_create_billing_account($1, $2, $3, $4, $5) AS id`,
    [
      params.organisationId,
      params.name,
      params.abn,
      params.billingEmail,
      params.timezone,
    ],
  );
  return result.rows[0]?.id ?? null;
};
