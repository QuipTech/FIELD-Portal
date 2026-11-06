import { PoolClient } from 'pg';

const setTenant = (client: PoolClient, tenantId: string) =>
  client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

// Runs `work` under another organisation's RLS context inside the current
// transaction, then switches back. The Owner changes people in any
// organisation, whose rows RLS only accepts under that organisation, while
// the audit entry stays under the Owner's own.
export const runInTenantContext = async <T>(
  client: PoolClient,
  params: { tenantId: string; returnToTenantId: string },
  work: () => Promise<T>,
): Promise<T> => {
  if (params.tenantId === params.returnToTenantId) return work();
  await setTenant(client, params.tenantId);
  const result = await work();
  await setTenant(client, params.returnToTenantId);
  return result;
};
