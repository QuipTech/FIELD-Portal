import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { UpsertSubscriptionDto } from './dto/upsertSubscriptionDto';
import { TenantSubscriptionRow } from './types/subscriptionRows';

// tenantId null lists every organisation; otherwise
// just that one.
export const listTenantSubscriptions = async (
  databaseService: DatabaseService,
  tenantId: string | null,
): Promise<TenantSubscriptionRow[]> => {
  const result = await databaseService.query<TenantSubscriptionRow>(
    `SELECT * FROM admin_list_tenant_subscriptions($1)`,
    [tenantId],
  );
  return result.rows;
};

// Resolves to whether a subscription existed before, or null when there's
// no such live organisation.
export const upsertTenantSubscription = async (
  client: PoolClient,
  params: { tenantId: string; updatedBy: string; terms: UpsertSubscriptionDto },
): Promise<boolean | null> => {
  const { terms } = params;
  const result = await client.query<{ existed: boolean | null }>(
    `SELECT admin_upsert_tenant_subscription(
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) AS existed`,
    [
      params.tenantId,
      terms.tier,
      terms.billingBasis ?? null,
      terms.licensedAssets ?? null,
      terms.startsOn,
      terms.endsOn ?? null,
      terms.aiMonthlyQueryAllowance ?? null,
      terms.wearableSeats,
      terms.remoteExpertSeats,
      terms.ssoEnabled,
      terms.notes || null,
      params.updatedBy,
    ],
  );
  return result.rows[0].existed;
};
