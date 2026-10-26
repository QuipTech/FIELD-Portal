import { PoolClient } from 'pg';
import { OrganisationSubscriptionRow } from './types/organisationSubscriptionResponse';

// Always one row: the LEFT JOINs leave the subscription columns null for
// an organisation with no live plan. Read from the billing account's
// subscriptions (migration 0096 lets the tenant role read its own); the
// main plan is Enterprise, else ASSET_PRO, else internal, else TECH.
// A plan that is ending reports its end date and doesn't renew.
export const findOrganisationSubscription = async (
  client: PoolClient,
  tenantId: string,
): Promise<OrganisationSubscriptionRow> => {
  const result = await client.query<OrganisationSubscriptionRow>(
    `SELECT s.plan_code AS tier, p.name AS plan_name,
            CASE s.plan_code WHEN 'ENTERPRISE' THEN 'negotiated'
                             WHEN 'ASSET_PRO' THEN 'per_asset'
                             WHEN 'TECH' THEN 'fixed_fee' END AS billing_basis,
            s.committed_qty AS licensed_assets,
            CASE WHEN s.status = 'cancelling' THEN s.cancel_at
                 WHEN s.term = 'annual' THEN s.current_period_end END AS ends_on,
            CASE WHEN s.status = 'cancelling' THEN 'manual' ELSE 'stripe' END AS source,
            NULL AS stripe_status,
            (SELECT count(*) FROM machines m
              WHERE m.tenant_id = $1 AND m.deleted_at IS NULL) AS asset_count
     FROM (SELECT 1) AS one
     LEFT JOIN LATERAL (
       SELECT sub.* FROM billing.subscriptions sub
       WHERE sub.billing_account_id = current_billing_account_id()
         AND sub.deleted_at IS NULL AND sub.status <> 'cancelled'
       ORDER BY array_position(ARRAY['ENTERPRISE','ASSET_PRO','INTERNAL','TECH'], sub.plan_code::text)
       LIMIT 1
     ) s ON true
     LEFT JOIN platform.plans p ON p.code = s.plan_code`,
    [tenantId],
  );
  return result.rows[0];
};
