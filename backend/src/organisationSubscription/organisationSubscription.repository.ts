import { PoolClient } from 'pg';
import { OrganisationSubscriptionRow } from './types/organisationSubscriptionResponse';

// Always one row: the LEFT JOINs leave the subscription columns null for
// an organisation that has never subscribed.
export const findOrganisationSubscription = async (
  client: PoolClient,
  tenantId: string,
): Promise<OrganisationSubscriptionRow> => {
  const result = await client.query<OrganisationSubscriptionRow>(
    `SELECT s.tier, p.name AS plan_name, s.billing_basis, s.licensed_assets,
            s.ends_on, s.source, s.stripe_status,
            (SELECT count(*) FROM machines m
              WHERE m.tenant_id = $1 AND m.deleted_at IS NULL) AS asset_count
     FROM (SELECT 1) AS one
     LEFT JOIN app.subscriptions s ON s.tenant_id = $1
     LEFT JOIN platform.plans p ON p.code = s.tier`,
    [tenantId],
  );
  return result.rows[0];
};
